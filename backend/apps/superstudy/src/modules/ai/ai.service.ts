import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import { AppConfigService } from '../app-config/app-config.service';

/**
 * AI Service — NestJS equivalent of aiProxy.js (Cloud Function) + aiService.js + aiGrammarService.js
 *
 * Architecture:
 *   - Model profile: FREE | STANDARD | PREMIUM (with variant: PRIMARY | BACKUP | BACKUP_2 | BACKUP_3)
 *   - Mode: chat | file_chat | audio | tts | image_generate | vision | hf_image | gtts
 *   - Provider: google (Gemini) | openrouter
 *   - Model config: loaded from AppConfigService (MongoDB) with 5-min TTL, env vars override, hardcoded defaults last
 *   - Waterfall: FREE key first → PAID key fallback (OpenRouter :free models skip paid retry)
 *
 * No Firebase or Firestore dependency.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly appConfigService: AppConfigService) {}

  // ──────────────────────────────────────────
  // HTTP helpers
  // ──────────────────────────────────────────

  private async post<T = any>(
    url: string,
    body: any,
    headers: Record<string, string> = {},
    timeoutMs = 110000,
  ): Promise<{ statusCode: number; data: T }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const payload = JSON.stringify(body);
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      };
      const lib = parsedUrl.protocol === 'https:' ? https : http;
      const req = lib.request(options, (res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunks: any[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { resolve({ statusCode: res.statusCode ?? 200, data: JSON.parse(text) }); }
          catch { resolve({ statusCode: res.statusCode ?? 200, data: text as any }); }
        });
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(payload);
      req.end();
    });
  }

  /** Binary GET — used for Google Translate TTS scrape */
  private async getBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      };
      const req = https.request(options, (res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunks: any[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({
          buffer: Buffer.concat(chunks),
          contentType: (res.headers['content-type'] as string) || 'audio/mpeg',
        }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('TTS request timeout')); });
      req.end();
    });
  }

  /** Binary POST — used for OpenRouter TTS which returns raw audio bytes */
  private async postBinary(url: string, body: any, headers: Record<string, string> = {}): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const payload = JSON.stringify(body);
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        port: parsedUrl.port || 443,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      };
      const req = https.request(options, (res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunks: any[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', reject);
      req.setTimeout(60000, () => { req.destroy(); reject(new Error('Binary POST timeout')); });
      req.write(payload);
      req.end();
    });
  }

  // ──────────────────────────────────────────
  // ENV helpers
  // ──────────────────────────────────────────

  private env(key: string): string {
    return process.env[key] || '';
  }

  private getApiKey(provider: string, usePaid = false): string {
    const keyName = `${provider.toUpperCase()}_API_KEY_${usePaid ? 'PAID' : 'FREE'}`;
    return this.env(keyName);
  }

  // ──────────────────────────────────────────
  // Model config resolution — mirrors aiProxy.js parseProfileVariant + resolveModelConfig
  // Now reads from AppConfigService (MongoDB) with env override + hardcoded defaults
  // ──────────────────────────────────────────

  /**
   * Parse profile string into { profile, variant }.
   * Mirrors parseProfileVariant() from aiProxy.js exactly.
   */
  private parseProfileVariant(profileInput = 'FREE'): { profile: string; variant: string } {
    const upper = (profileInput || 'FREE').toUpperCase();
    const match3 = upper.match(/^(FREE|STANDARD|PREMIUM)_(BACKUP_3)$/);
    if (match3) return { profile: match3[1], variant: match3[2] };
    const match2 = upper.match(/^(FREE|STANDARD|PREMIUM)_(BACKUP_2)$/);
    if (match2) return { profile: match2[1], variant: match2[2] };
    const match1 = upper.match(/^(FREE|STANDARD|PREMIUM)_(BACKUP)$/);
    if (match1) return { profile: match1[1], variant: match1[2] };
    if (['FREE', 'STANDARD', 'PREMIUM'].includes(upper)) {
      return { profile: upper, variant: 'PRIMARY' };
    }
    return { profile: upper, variant: 'PRIMARY' };
  }

  /**
   * Resolve the model config string for a given profile+mode.
   * Mirrors resolveModelConfig() from aiProxy.js — now reads from MongoDB AppConfig (no Firestore).
   */
  private async resolveModelConfig(profileInput: string, mode: string): Promise<string | null> {
    const config = await this.appConfigService.getAiModelConfig();
    const { profile, variant } = this.parseProfileVariant(profileInput);

    // Media guard for FREE tier (mirrors original)
    if (profile === 'FREE' && mode !== 'chat') {
      const enabled = config['FREE_MEDIA_ENABLED'] || 'false';
      if (enabled === 'false') {
        throw { code: 403, message: 'Media features (Audio/Vision/Image) are disabled for FREE tier.' };
      }
    }

    let envKey = '';
    switch (mode) {
      case 'vision':         envKey = `${profile}_MEDIA_VISION`;   break;
      case 'tts':            envKey = `${profile}_MEDIA_AUDIO`;    break;
      case 'image_generate': envKey = `${profile}_MEDIA_IMAGE`;    break;
      case 'audio':          envKey = `${profile}_MEDIA_LISTENING`; break;
      case 'file_chat':
      case 'chat':
      default:               envKey = `${profile}_MODEL_${variant}`; break;
    }

    if (config[envKey]) return config[envKey];

    // Fallbacks (mirrors aiProxy.js)
    if (mode === 'vision' && config[`${profile}_MODEL_PRIMARY`]) return config[`${profile}_MODEL_PRIMARY`];
    if (mode === 'audio' && config[`${profile}_MEDIA_VISION`]) return config[`${profile}_MEDIA_VISION`];
    if (mode === 'audio' && config[`${profile}_MODEL_PRIMARY`]) return config[`${profile}_MODEL_PRIMARY`];

    return null;
  }

  private parseConfig(configStr: string): { provider: string; model: string } {
    if (!configStr || !configStr.includes(':')) return { provider: 'openrouter', model: configStr };
    const idx = configStr.indexOf(':');
    return { provider: configStr.slice(0, idx).toLowerCase(), model: configStr.slice(idx + 1) };
  }

  // ──────────────────────────────────────────
  // PCM → WAV conversion (mirrors aiProxy.js pcmToWav)
  // ──────────────────────────────────────────

  private pcmToWav(pcmBuffer: Buffer): Buffer {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataLen = pcmBuffer.length;
    const totalLen = 36 + dataLen;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(totalLen, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataLen, 40);

    return Buffer.concat([header, pcmBuffer] as any[]);
  }

  // ──────────────────────────────────────────
  // Media resolution helper (mirrors aiProxy.js normalizeMediaResolution)
  // ──────────────────────────────────────────

  private normalizeMediaResolution(value?: string | null): string | null {
    if (!value) return null;
    const normalized = String(value).trim().toUpperCase();
    if (!normalized) return null;
    return normalized.startsWith('MEDIA_RESOLUTION_') ? normalized : `MEDIA_RESOLUTION_${normalized}`;
  }

  private normalizeInlineImages(images?: any[]): Array<{ data: string; mimeType: string }> {
    return (Array.isArray(images) ? images : [])
      .filter((img) => img && typeof img.data === 'string' && img.data.trim())
      .map((img) => ({ data: img.data, mimeType: img.mimeType || 'image/jpeg' }));
  }

  // ──────────────────────────────────────────
  // Core API provider call — mirrors callApiProvider() from aiProxy.js
  // ──────────────────────────────────────────

  private async callApiProvider(opts: {
    provider: string;
    model: string;
    apiKey: string;
    system?: string;
    user?: string;
    format?: string;
    mode: string;
    mediaData?: string | null;
    mimeType?: string | null;
    images?: any[];
    thinkingLevel?: string;
    mediaResolution?: string;
    speechConfig?: any;
    courseConfig?: any;
  }): Promise<any> {
    const {
      provider, model, apiKey, system = '', user = '',
      format, mode, mediaData, mimeType,
      thinkingLevel, mediaResolution: rawMediaResolution,
      speechConfig: rawSpeechConfig, courseConfig,
    } = opts;

    const inlineImages = this.normalizeInlineImages(opts.images);
    const hasImageInputs = inlineImages.length > 0 || (mode === 'vision' && !!mediaData);
    const mediaResolution = hasImageInputs ? this.normalizeMediaResolution(rawMediaResolution) : null;

    // ─── GOOGLE PROVIDER ───
    if (provider === 'google') {

      // A. TTS
      if (mode === 'tts') {
        if (model.toLowerCase().includes('gemini')) {
          // Gemini Audio Generation (PCM → WAV)
          let speechConfig = rawSpeechConfig;
          if (!speechConfig) {
            let voiceName = 'Charon';
            const instructions = courseConfig?.instructions || '';
            const lc = instructions.toLowerCase();
            if (/female|woman|girl/.test(lc)) voiceName = 'Aoede';
            else if (/male|man|boy/.test(lc)) voiceName = 'Charon';
            else {
              if (instructions.includes('7-year-old') || instructions.includes('Beginner')) voiceName = 'Aoede';
              else if (instructions.includes('Business') || instructions.includes('University')) voiceName = 'Aoede';
              else if (instructions.includes('Intermediate') || instructions.includes('Fluent')) voiceName = 'Charon';
            }
            speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName } } };
          }

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const body = {
            contents: [{ parts: [{ text: user }] }],
            generationConfig: { responseModalities: ['AUDIO'], speechConfig },
          };
          const { statusCode, data } = await this.post(url, body);
          if (statusCode !== 200) {
            const msg = data?.error?.message || JSON.stringify(data);
            if (statusCode === 429) throw new Error('QUOTA_EXCEEDED');
            throw new Error(`API Error ${statusCode}: ${msg}`);
          }

          // Gemini returns PCM — convert to WAV
          if (data?.candidates?.[0]?.content?.parts) {
            for (const part of data.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                const pcmBuffer = Buffer.from(part.inlineData.data, 'base64');
                const wavBuffer = this.pcmToWav(pcmBuffer);
                return { type: 'audio', data: wavBuffer, contentType: 'audio/wav' };
              }
            }
          }
          // Legacy TTS (MP3)
          if (data?.audioContent) {
            return { type: 'audio', data: Buffer.from(data.audioContent, 'base64'), contentType: 'audio/mpeg' };
          }
          throw new Error('Google TTS missing audioContent or inlineData');
        } else {
          // Legacy Google Cloud TTS
          let speakingRate = 1.0;
          if (courseConfig?.speed) speakingRate = Math.max(0.25, Math.min(4.0, parseFloat(courseConfig.speed)));

          let voiceParams: any = { languageCode: 'en-US', name: 'en-US-Studio-O' };
          const instructions = courseConfig?.instructions || '';
          if (instructions.includes('7-year-old') || instructions.includes('children')) {
            voiceParams = { languageCode: 'en-US', name: 'en-US-Journey-F' };
          } else if (instructions.includes('Beginner')) {
            voiceParams = { languageCode: 'en-GB', name: 'en-GB-Neural2-A' };
          } else if (instructions.includes('Intermediate') || instructions.includes('Narrative')) {
            voiceParams = { languageCode: 'en-GB', name: 'en-GB-Neural2-B' };
          } else if (instructions.includes('Business') || instructions.includes('Professional')) {
            voiceParams = { languageCode: 'en-US', name: 'en-US-Studio-O' };
          } else if (instructions.includes('University') || instructions.includes('Academic')) {
            voiceParams = { languageCode: 'en-AU', name: 'en-AU-Neural2-A' };
          } else if (instructions.includes('Fluent') || instructions.includes('casual')) {
            voiceParams = { languageCode: 'en-US', name: 'en-US-Neural2-J' };
          } else if (model.includes('journey')) {
            voiceParams = { languageCode: 'en-US', name: 'en-US-Journey-F' };
          }

          const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
          const body = {
            input: { text: user },
            voice: voiceParams,
            audioConfig: { audioEncoding: 'MP3', speakingRate },
          };
          const { statusCode, data } = await this.post(url, body);
          if (statusCode !== 200) throw new Error(`Legacy TTS Error ${statusCode}`);
          if (data?.audioContent) {
            return { type: 'audio', data: Buffer.from(data.audioContent, 'base64'), contentType: 'audio/mpeg' };
          }
          throw new Error('Legacy TTS missing audioContent');
        }
      }

      // B. Image Generation (Imagen)
      if (mode === 'image_generate') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
        const body = { instances: [{ prompt: user }], parameters: { sampleCount: 1, aspectRatio: '1:1' } };
        const { statusCode, data } = await this.post(url, body);
        if (statusCode !== 200) throw new Error(`Image Gen Error ${statusCode}`);
        if (data?.predictions?.[0]?.bytesBase64Encoded) {
          return { type: 'image', data: data.predictions[0].bytesBase64Encoded, format: 'base64' };
        }
        return data;
      }

      // C. Audio Listening (Pronunciation / Grading)
      if (mode === 'audio') {
        if (!mediaData) throw new Error('Audio data required for listening mode.');
        const audioMimeType = mimeType || 'audio/webm';
        const parts: any[] = [];
        if (system) parts.push({ text: system });
        if (user) parts.push({ text: user });
        inlineImages.forEach((img) => {
          parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
        });
        parts.push({ inline_data: { mime_type: audioMimeType, data: mediaData } });

        const payload: any = { contents: [{ role: 'user', parts }] };
        const genConfig: any = {};
        if (format === 'json_object') genConfig.responseMimeType = 'application/json';
        if (mediaResolution) genConfig.mediaResolution = mediaResolution;
        if (Object.keys(genConfig).length) payload.generationConfig = genConfig;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const { statusCode, data } = await this.post(url, payload);
        if (statusCode !== 200) {
          const msg = data?.error?.message || JSON.stringify(data);
          if (statusCode === 429) throw new Error('QUOTA_EXCEEDED');
          throw new Error(`API Error ${statusCode}: ${msg}`);
        }
        return this.normalizeGoogleTextResponse(data);
      }

      // D. Chat, Vision & File Chat
      {
        const parts: any[] = [];
        if (user) parts.push({ text: user });

        if (mode === 'vision' && mediaData) {
          const imageMimeType = mimeType || 'image/jpeg';
          parts.push({ inline_data: { mime_type: imageMimeType, data: mediaData } });
        }

        inlineImages.forEach((img) => {
          parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
        });

        if (mode === 'file_chat' && mediaData) {
          const fileMime = mimeType || 'application/pdf';
          parts.push({ inline_data: { mime_type: fileMime, data: mediaData } });
        }

        const payload: any = { contents: [{ role: 'user', parts }] };
        if (system) payload.system_instruction = { parts: { text: system } };

        const genConfig: any = {};
        if (format === 'json_object') genConfig.responseMimeType = 'application/json';
        if (thinkingLevel) {
          // Use thinkingLevel string format (mirrors aiProxy.js — NOT thinkingBudget integer)
          genConfig.thinkingConfig = { thinkingLevel: thinkingLevel.toUpperCase() };
        }
        if (mediaResolution) genConfig.mediaResolution = mediaResolution;
        if (Object.keys(genConfig).length) payload.generationConfig = genConfig;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const { statusCode, data } = await this.post(url, payload);
        if (statusCode !== 200) {
          const msg = data?.error?.message || JSON.stringify(data);
          if (statusCode === 429) throw new Error('QUOTA_EXCEEDED');
          throw new Error(`API Error ${statusCode}: ${msg}`);
        }
        return this.normalizeGoogleTextResponse(data);
      }
    }

    // ─── OPENROUTER PROVIDER ───
    {
      const orHeaders: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://upenglishvietnam.com',
        'X-Title': 'UpEnglish AI',
      };

      if (mode === 'audio') {
        throw new Error('Audio listening mode is only supported with Google Gemini. Configure MEDIA_LISTENING with "google:" prefix.');
      }

      if (mode === 'tts') {
        let speed = 1.0;
        if (courseConfig?.speed) speed = parseFloat(courseConfig.speed);
        const audioBytes = await this.postBinary(
          'https://openrouter.ai/api/v1/audio/speech',
          { model, input: user, voice: 'alloy', speed },
          orHeaders,
        );
        return { type: 'audio', data: audioBytes, contentType: 'audio/mpeg' };
      }

      if (mode === 'image_generate') {
        const { statusCode, data } = await this.post(
          'https://openrouter.ai/api/v1/images/generations',
          { model, prompt: user, n: 1, size: '1024x1024' },
          orHeaders,
        );
        if (statusCode !== 200) throw new Error(`OR Image Gen Error ${statusCode}`);
        if (data?.data?.[0]?.url) return { type: 'image', data: data.data[0].url, format: 'url' };
        if (data?.data?.[0]?.b64_json) return { type: 'image', data: data.data[0].b64_json, format: 'base64' };
        return data;
      }

      // Chat / Vision
      let userContent: any = user;
      const imageParts: any[] = [];
      if (mode === 'vision' && mediaData) {
        const imageMimeType = mimeType || 'image/jpeg';
        imageParts.push({ type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${mediaData}` } });
      }
      inlineImages.forEach((img) => {
        imageParts.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
      });
      if (imageParts.length) {
        userContent = [];
        if (user) userContent.push({ type: 'text', text: user });
        userContent.push(...imageParts);
      }

      const messages: any[] = [];
      if (system) messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: userContent });

      const body: any = { model, messages };
      if (format === 'json_object') body.response_format = { type: 'json_object' };

      const { statusCode, data } = await this.post('https://openrouter.ai/api/v1/chat/completions', body, orHeaders);
      if (statusCode !== 200) {
        const msg = data?.error?.message || JSON.stringify(data);
        if (statusCode === 429) throw new Error('QUOTA_EXCEEDED');
        throw new Error(`API Error ${statusCode}: ${msg}`);
      }

      // Clean OpenRouter thinking tags
      if (data?.choices?.[0]?.message?.content?.includes('<think>')) {
        data.choices[0].message.content = data.choices[0].message.content
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .trim();
      }

      return data;
    }
  }

  /** Normalize Google Gemini response to OpenAI-compatible shape */
  private normalizeGoogleTextResponse(data: any): any {
    let text = '';
    if (data?.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.thought === true) continue; // skip thinking parts
        text += part.text || '';
      }
    }
    // Clean <think>...</think> tags
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    return { choices: [{ message: { content: text } }] };
  }

  // ──────────────────────────────────────────
  // Waterfall: Free key → Paid key
  // Mirrors attemptGeneration() from aiProxy.js
  // ──────────────────────────────────────────

  private async attemptGeneration(
    configStr: string,
    callOpts: Omit<Parameters<typeof this.callApiProvider>[0], 'provider' | 'model' | 'apiKey'>,
  ): Promise<any> {
    const { provider, model } = this.parseConfig(configStr);

    // Guard: OpenRouter :free models never retry with paid key (mirrors aiProxy.js)
    const shouldRetryPaid = !(provider === 'openrouter' && model.includes(':free'));

    const freeKey = this.getApiKey(provider, false);
    if (freeKey) {
      try {
        return await this.callApiProvider({ ...callOpts, provider, model, apiKey: freeKey });
      } catch (err: any) {
        if (!shouldRetryPaid) throw err;
        this.logger.warn(`[AI] Free key failed for ${provider}:${model}, trying paid key. Error: ${err?.message}`);
      }
    }

    if (shouldRetryPaid) {
      const paidKey = this.getApiKey(provider, true);
      if (paidKey) {
        return await this.callApiProvider({ ...callOpts, provider, model, apiKey: paidKey });
      }
    }

    throw new ServiceUnavailableException(`No valid API key available for provider: ${provider}`);
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API — PRIMARY ENDPOINT
  // Mirrors the full aiProxy.js processRequest() logic
  // ══════════════════════════════════════════════════════════════

  /**
   * Unified proxy — mirrors aiProxy.js processRequest() fully.
   * Accepts the same input shape as the original Cloud Function.
   */
  async proxy(input: {
    action?: string;
    modelProfile?: string;
    mode?: string;
    systemPrompt?: string;
    userContent?: string;
    responseFormat?: string;
    image?: string;
    mimeType?: string;
    audio?: string;
    fileData?: string;
    fileMimeType?: string;
    images?: any[];
    thinkingLevel?: string;
    mediaResolution?: string;
    speechConfig?: any;
    courseConfig?: any;
    text?: string;   // for gtts action
    lang?: string;   // for gtts action
    prompt?: string; // for hf_image action
    model?: string;  // for hf_image action
  }): Promise<any> {
    // Special route: gtts
    if (input.action === 'gtts') {
      return this.gtts(input.text || '', input.lang);
    }

    // Special route: Hugging Face image generation
    if (input.action === 'hf_image') {
      return this.hfImageGenerate({ prompt: input.prompt || '', model: input.model });
    }

    const profile = input.modelProfile || 'FREE';
    const mode = input.mode || 'chat';

    const configStr = await this.resolveModelConfig(profile, mode);
    if (!configStr) {
      const { profile: baseProfile } = this.parseProfileVariant(profile);
      if (baseProfile === 'FREE') {
        throw new BadRequestException('Feature disabled or not configured for FREE tier.');
      }
      throw new ServiceUnavailableException(`Missing configuration for ${profile} / ${mode}`);
    }

    const system = input.systemPrompt || '';
    const user = input.userContent || '';
    const format = input.responseFormat || undefined;

    let mediaData: string | null = null;
    let mimeType: string | null = null;

    if (mode === 'vision') {
      mediaData = input.image || null;
      mimeType = input.mimeType || 'image/jpeg';
      if (!mediaData) throw new BadRequestException('Image data required for vision mode.');
    } else if (mode === 'audio') {
      mediaData = input.audio || null;
      mimeType = input.mimeType || 'audio/webm';
      if (!mediaData) throw new BadRequestException('Audio data required for audio listening mode.');
    } else if (mode === 'file_chat') {
      mediaData = input.fileData || null;
      mimeType = input.fileMimeType || 'application/pdf';
      if (!mediaData) throw new BadRequestException('File data required for file_chat mode.');
    }

    return this.attemptGeneration(configStr, {
      system,
      user,
      format,
      mode,
      mediaData,
      mimeType,
      images: input.images,
      thinkingLevel: input.thinkingLevel,
      mediaResolution: input.mediaResolution,
      speechConfig: input.speechConfig,
      courseConfig: input.courseConfig,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // INDIVIDUAL FEATURE METHODS (used by specific endpoints + grading)
  // ══════════════════════════════════════════════════════════════

  /**
   * Google Translate TTS proxy — mirrors aiProxy.js handleGtts()
   */
  async gtts(text: string, lang = 'en-US'): Promise<{ success: boolean; audio: string; contentType: string }> {
    if (!text) throw new BadRequestException('Text required');
    let pronText = text.trim();
    if (!/[.!?]$/.test(pronText)) pronText += '.';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(pronText)}`;
    try {
      const { buffer, contentType } = await this.getBuffer(url);
      return { success: true, audio: buffer.toString('base64'), contentType };
    } catch (err) {
      this.logger.error('Google Translate TTS failed', err);
      throw new ServiceUnavailableException('Failed to fetch from Google TTS');
    }
  }

  /**
   * Hugging Face image generation — mirrors aiProxy.js hf_image action.
   * Uses HF_API_TOKEN env var.
   */
  async hfImageGenerate(params: { prompt: string; model?: string }): Promise<any> {
    const hfToken = this.env('HF_API_TOKEN');
    if (!hfToken) throw new ServiceUnavailableException('HF_API_TOKEN not configured.');

    const model = params.model || 'black-forest-labs/FLUX.1-schnell';
    if (!params.prompt) throw new BadRequestException('Prompt required for hf_image.');

    const url = `https://router.huggingface.co/hf-inference/models/${model}`;
    const hfHeaders: Record<string, string> = {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    };

    const imageBuffer = await this.postBinary(url, { inputs: params.prompt }, hfHeaders);
    const base64 = imageBuffer.toString('base64');
    return { success: true, image: base64, contentType: 'image/jpeg' };
  }

  /**
   * Gemini TTS — mirrors tts mode in aiProxy.js for Gemini native models.
   */
  async geminiTts(params: {
    modelProfile?: string;
    text: string;
    courseConfig?: { instructions?: string; speed?: number };
    speechConfig?: Record<string, any>;
  }): Promise<{ success: boolean; audio: string; contentType: string }> {
    const configStr = await this.resolveModelConfig(params.modelProfile || 'STANDARD', 'tts');
    if (!configStr) throw new ServiceUnavailableException('No TTS model configured');

    const { provider, model } = this.parseConfig(configStr);
    if (provider !== 'google') throw new BadRequestException('Gemini TTS only supports Google provider');

    const result = await this.attemptGeneration(configStr, {
      mode: 'tts',
      user: params.text,
      system: '',
      speechConfig: params.speechConfig,
      courseConfig: params.courseConfig,
    });

    if (result?.type === 'audio') {
      const buf: Buffer = result.data;
      return { success: true, audio: buf.toString('base64'), contentType: result.contentType };
    }
    throw new ServiceUnavailableException('No audio in Gemini TTS response');
  }

  /**
   * Text chat completion — simplified method used by grading and grammar endpoints.
   */
  async chat(params: {
    modelProfile?: string;
    systemPrompt?: string;
    userContent: string;
    responseFormat?: string;
    thinkingLevel?: string;
    images?: any[];
    mediaResolution?: string;
  }): Promise<{ choices: Array<{ message: { content: string } }> }> {
    const profile = params.modelProfile || 'STANDARD';
    const configStr = await this.resolveModelConfig(profile, 'chat');
    if (!configStr) throw new ServiceUnavailableException('No chat model configured');

    const result = await this.attemptGeneration(configStr, {
      mode: 'chat',
      system: params.systemPrompt || '',
      user: params.userContent,
      format: params.responseFormat,
      thinkingLevel: params.thinkingLevel,
      images: params.images,
      mediaResolution: params.mediaResolution,
    });
    return result;
  }

  /**
   * Audio evaluation — pronunciation or speaking grading (Gemini audio mode).
   */
  async audioEval(params: {
    modelProfile?: string;
    systemPrompt: string;
    userContent: string;
    audio: string;
    mimeType?: string;
    responseFormat?: string;
  }): Promise<any> {
    const configStr = await this.resolveModelConfig(params.modelProfile || 'STANDARD', 'audio');
    if (!configStr) throw new ServiceUnavailableException('No audio model configured');

    const { provider } = this.parseConfig(configStr);
    if (provider !== 'google') throw new BadRequestException('Audio eval only supports Google Gemini provider');

    const result = await this.attemptGeneration(configStr, {
      mode: 'audio',
      system: params.systemPrompt,
      user: params.userContent,
      mediaData: params.audio,
      mimeType: params.mimeType || 'audio/webm',
      format: params.responseFormat,
    });

    const text = result?.choices?.[0]?.message?.content || '';
    try {
      const cleaned = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { score: 50, transcript: '(Parse error)', feedback: text };
    }
  }

  /**
   * Image generation via Imagen (Google).
   */
  async imageGenerate(params: { modelProfile?: string; prompt: string }): Promise<any> {
    const configStr = await this.resolveModelConfig(params.modelProfile || 'STANDARD', 'image_generate');
    if (!configStr) throw new ServiceUnavailableException('No image generation model configured');

    return this.attemptGeneration(configStr, {
      mode: 'image_generate',
      user: params.prompt,
      system: '',
    });
  }

  // ──────────────────────────────────────────
  // Grammar AI methods (mirrors aiGrammarService.js)
  // ──────────────────────────────────────────

  async generateGrammarVariations(params: {
    originalQuestion: Record<string, any>;
    purpose: string;
    type: string;
    settings?: Record<string, any>;
  }): Promise<any> {
    const { type, settings = {} } = params;
    const systemPrompt = this.buildGrammarVariationPrompt(params.originalQuestion, params.purpose, type, settings, 4);
    const userContent = `Đề bài gốc (Variation 1):\n${JSON.stringify(params.originalQuestion, null, 2)}`;

    const result = await this.chat({ systemPrompt, userContent, responseFormat: 'json_object', thinkingLevel: 'HIGH' });
    const text = result.choices[0].message.content;
    const data = JSON.parse(text);

    if (data.improved_original && Array.isArray(data.variations) && data.variations.length >= 4) {
      if (type === 'multiple_choice') {
        data.improved_original = this.shuffleChoices(data.improved_original);
        data.variations = data.variations.map((v: any) => this.shuffleChoices(v));
      }
      return data;
    }
    return this.buildMockVariations(params.originalQuestion, 4);
  }

  async generateSingleGrammarVariation(params: {
    originalQuestion: Record<string, any>;
    purpose: string;
    type: string;
    settings?: Record<string, any>;
  }): Promise<any> {
    const systemPrompt = this.buildGrammarVariationPrompt(params.originalQuestion, params.purpose, params.type, params.settings || {}, 1);
    const userContent = `Đề bài gốc (Variation 1):\n${JSON.stringify(params.originalQuestion, null, 2)}`;

    const result = await this.chat({ systemPrompt, userContent, responseFormat: 'json_object', thinkingLevel: 'HIGH' });
    let data = JSON.parse(result.choices[0].message.content);
    if (params.type === 'multiple_choice') data = this.shuffleChoices(data);
    return data;
  }

  async gradeGrammarSubmission(params: {
    question: Record<string, any>;
    studentAnswer: any;
    purpose: string;
    type: string;
    specialRequirement?: string;
    context?: string;
    teacherTitle?: string;
    studentTitle?: string;
    questionIndex?: number;
    totalQuestions?: number;
    cefrLevel?: string;
    maxPoints?: number;
    useDefaultCriteria?: boolean;
  }): Promise<any> {
    const {
      question, studentAnswer, purpose, type,
      specialRequirement = '', context = '',
      teacherTitle = 'thầy/cô', studentTitle = 'em',
      questionIndex = 0, totalQuestions = 0,
      cefrLevel = '', maxPoints = 10,
      useDefaultCriteria = true,
    } = params;

    const plainContext = context ? context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const totalQInfo = totalQuestions > 0
      ? `\n\nLearning context: Student is working on a test of ${totalQuestions} questions. You are grading question ${questionIndex + 1}/${totalQuestions}.`
      : '';
    const greetingNote = questionIndex > 0 ? `\nDo NOT greet the student again (already greeted in Q1). Go straight to the feedback.` : '';

    const systemPrompt = `Bạn là giáo viên chấm bài luyện tiếng Anh. Gọi học viên bằng "${studentTitle}". Có thể xưng "${teacherTitle}" nhưng KHÔNG nhất thiết phải xưng hô trong mọi câu.${totalQInfo}${greetingNote}
${cefrLevel ? `Trình độ mục tiêu của học viên: ${cefrLevel}.` : ''}
Loại bài luyện: ${type}
Mục đích kiểm tra: ${purpose}
${plainContext ? `\nNGỮ CẢNH:\n"""\n${plainContext}\n"""` : ''}
${specialRequirement ? `\nYÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN:\n"""\n${specialRequirement}\n"""` : ''}
${useDefaultCriteria ? `Câu trả lời đúng nhưng THIẾU thông tin quan trọng: tối đa ${Math.round(maxPoints * 0.55)}-${Math.round(maxPoints * 0.6)}/${maxPoints}.` : 'Chấm theo YÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN.'}
Chỉ ra lỗi sai, giải thích lý do, đề xuất điểm số từ 0 đến ${maxPoints}.
Viết feedback bằng TIẾNG VIỆT. KHÔNG dùng Markdown heading. Dùng **in đậm** để nhấn mạnh.

Trả về JSON:
{
  "score": number,
  "feedback": "nhận xét bằng tiếng Việt",
  "teacherNote": "ghi chú cho giáo viên",
  "detectedErrors": ["key1"]
}`;

    const userContent = `Dữ liệu câu hỏi:\n${JSON.stringify(question, null, 2)}\n\nCâu trả lời của học sinh:\n${JSON.stringify(studentAnswer, null, 2)}`;
    const result = await this.chat({ systemPrompt, userContent, responseFormat: 'json_object', thinkingLevel: 'HIGH' });
    return JSON.parse(result.choices[0].message.content);
  }

  /**
   * Grade essay question using AI — mirrors gradeEssayOnServer() from scheduledNotifications.js.
   * Used by server-side exam auto-submit grading.
   */
  async gradeEssay(params: {
    variation: Record<string, any>;
    studentAnswer: any;
    purpose: string;
    type: string;
    specialRequirement?: string;
    contextHtml?: string;
    teacherTitle?: string;
    studentTitle?: string;
    questionIndex?: number;
    previousResults?: any[];
  }): Promise<{ score: number; feedback: string; teacherNote: string; detectedErrors: string[] }> {
    const {
      variation, studentAnswer, purpose, type,
      specialRequirement = '', contextHtml = '',
      teacherTitle = 'thầy/cô', studentTitle = 'em',
      questionIndex = 0, previousResults = [],
    } = params;

    const stripHtml = (v: string) => typeof v === 'string'
      ? v.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
      : '';

    const plainContext = stripHtml(contextHtml);
    const teacherReferenceAnswer = stripHtml(
      variation?.sampleAnswer || variation?.referenceAnswer || variation?.explanation || '',
    );
    const questionHtml = typeof variation?.text === 'string' ? variation.text
      : typeof variation?.content === 'string' ? variation.content : '';

    const greetingInstruction = questionIndex > 0
      ? `\nĐây là câu hỏi thứ ${questionIndex + 1} trong bài. KHÔNG chào lại học viên (đã chào ở câu 1). Đi thẳng vào nhận xét nội dung.`
      : '';

    const previousResultsContext = previousResults.length > 0
      ? `\nKẾT QUẢ CÁC CÂU TRƯỚC TRONG CÙNG BÀI:\n${previousResults.map(r => `- Câu ${r.questionNumber} (${r.typeName}): ${r.isCorrect ? 'ĐÚNG' : 'SAI'} — ${r.score}/${r.maxScore} điểm`).join('\n')}`
      : '';

    const systemPrompt = `Bạn là giáo viên chấm bài luyện tiếng Anh. Khi xưng hô, hãy xưng là "${teacherTitle}".${greetingInstruction}
Loại bài luyện: ${type}
Mục đích kiểm tra: ${purpose}
${plainContext ? `\nNGỮ CẢNH / ĐỀ BÀI:\n"""\n${plainContext}\n"""` : ''}
${specialRequirement ? `\nYÊU CẦU ĐẶC BIỆT TỪ GIÁO VIÊN:\n"""\n${specialRequirement}\n"""` : ''}
${teacherReferenceAnswer ? `\nĐÁP ÁN / KHUNG GỢI Ý TỪ GIÁO VIÊN:\n"""\n${teacherReferenceAnswer}\n"""` : ''}
${previousResultsContext}

Hãy phân tích câu trả lời của học sinh. Chấm điểm từ 0 đến 10.
- Nếu có đáp án / khung gợi ý từ giáo viên, hãy dùng đó làm chuẩn chính.
- Chấp nhận câu trả lời đúng theo đúng phạm vi giáo viên yêu cầu, ngay cả khi có thể phân tích sâu hơn.
- KHÔNG tự ý đòi thêm thuật ngữ hoặc tầng phân tích chi tiết hơn đáp án giáo viên.

LƯU Ý: Toàn bộ phản hồi bằng TIẾNG VIỆT. KHÔNG dùng Markdown formatting.

Trả về JSON:
{
  "score": number,
  "feedback": "Nhận xét chi tiết bằng TIẾNG VIỆT",
  "teacherNote": "Ghi chú cho giáo viên bằng TIẾNG VIỆT",
  "detectedErrors": []
}`;

    const userContent = `Dữ liệu câu hỏi:\n${JSON.stringify(variation, null, 2)}\n\nCâu trả lời của học sinh:\n${JSON.stringify(studentAnswer, null, 2)}`;
    const result = await this.chat({ systemPrompt, userContent, responseFormat: 'json_object', thinkingLevel: 'HIGH' });
    return JSON.parse(result.choices[0].message.content);
  }

  async gradeFillInBlankBlanks(params: {
    questionText: string;
    blanks: Array<{ idx: number; expected: string; studentAnswer: string; exactMatch: boolean }>;
    context?: string;
  }): Promise<{ verdicts: boolean[] }> {
    const { questionText, blanks, context = '' } = params;
    const plainContext = context ? context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const blankDetails = blanks.map(b =>
      `Chỗ trống ${b.idx + 1}: Đáp án="${b.expected}", Học viên="${b.studentAnswer}" → ${b.exactMatch ? '✅ Đúng' : '❓ Cần đánh giá'}`
    ).join('\n');

    const systemPrompt = `Bạn là giáo viên chấm bài điền vào chỗ trống tiếng Anh.
${plainContext ? `\nNGỮ CẢNH:\n"""\n${plainContext}\n"""` : ''}
Câu hỏi: "${questionText}"
${blankDetails}
NHIỆM VỤ: Đánh giá những chỗ "❓ Cần đánh giá". Chấp nhận nếu đồng nghĩa, đúng ngữ pháp. Không chấp nhận nếu sai nghĩa hoặc sai ngữ pháp.
Trả về JSON: { "verdicts": [true, false, ...] } — ${blanks.length} phần tử theo thứ tự tương ứng.`;

    const result = await this.chat({ systemPrompt, userContent: 'Đánh giá từng chỗ trống.', responseFormat: 'json_object' });
    const data = JSON.parse(result.choices[0].message.content);
    if (Array.isArray(data.verdicts) && data.verdicts.length === blanks.length) return data;
    return { verdicts: blanks.map(b => b.exactMatch) };
  }

  async classifyErrorCategory(params: {
    targetSkill: string;
    type: string;
    purpose: string;
    questionText: string;
    options?: string[];
  }): Promise<{ category: string }> {
    let skillGroup = params.targetSkill || 'grammar';
    if (params.type === 'audio_recording') skillGroup = 'speaking';

    const ERROR_CATEGORIES: Record<string, string[]> = {
      grammar: ['verb_tense', 'article', 'preposition', 'word_form', 'subject_verb_agreement', 'pronoun', 'conjunction', 'comparison', 'passive_voice', 'conditional', 'modal_verb', 'relative_clause', 'reported_speech', 'question_form', 'gerund_infinitive', 'quantifier'],
      listening: ['listening_detail', 'listening_main_idea', 'listening_inference'],
      speaking: ['pronunciation_sounds', 'pronunciation_stress', 'pronunciation_intonation', 'fluency'],
      reading: ['reading_detail', 'reading_main_idea', 'reading_inference', 'reading_vocabulary'],
      writing: ['writing_structure', 'writing_coherence', 'writing_grammar'],
      vocabulary: ['vocabulary_meaning', 'vocabulary_usage', 'vocabulary_collocation'],
    };

    const validCategories = ERROR_CATEGORIES[skillGroup] || ERROR_CATEGORIES.grammar;
    const categoryList = validCategories.join(', ');
    const plainText = (params.questionText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    const systemPrompt = `Classify the following English learning question into exactly ONE category.
Available categories: ${categoryList}, "other"
Skill: ${skillGroup}, Purpose: "${params.purpose || ''}", Text: "${plainText.slice(0, 300)}"
${params.options?.length ? `Options: ${params.options.join(', ')}` : ''}
Return JSON: { "category": "one_of_the_categories" }`;

    const result = await this.chat({ systemPrompt, userContent: 'Classify this question.', responseFormat: 'json_object' });
    const data = JSON.parse(result.choices[0].message.content);
    const category = data.category || 'other';
    const allValid = [...Object.values(ERROR_CATEGORIES).flat(), 'other'];
    return { category: allValid.includes(category) ? category : 'other' };
  }

  async gradeAudioAnswer(params: {
    audio: string;
    mimeType?: string;
    questionText: string;
    purpose: string;
    specialRequirement?: string;
    maxPoints?: number;
    context?: string;
    teacherTitle?: string;
    studentTitle?: string;
    questionIndex?: number;
    totalQuestions?: number;
    cefrLevel?: string;
    useDefaultCriteria?: boolean;
  }): Promise<any> {
    const {
      audio, mimeType = 'audio/webm',
      questionText, purpose,
      specialRequirement = '', context = '',
      teacherTitle = 'thầy/cô', studentTitle = 'em',
      questionIndex = 0, totalQuestions = 0,
      cefrLevel = '', maxPoints = 10, useDefaultCriteria = true,
    } = params;

    const plainContext = context ? context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const totalQInfo = totalQuestions > 0 ? `\nBài gồm ${totalQuestions} câu. Đây là câu ${questionIndex + 1}.` : '';
    const greetNote = questionIndex > 0 ? '\nKHÔNG chào lại học viên. Đi thẳng vào nhận xét.' : '';

    const systemPrompt = `Bạn là giáo viên tiếng Anh đang chấm bài nói cho học viên Việt Nam. Gọi học viên bằng "${studentTitle}".${totalQInfo}${greetNote}
${cefrLevel ? `Trình độ: ${cefrLevel}.` : ''}
**PHÁT HIỆN IM LẶNG:** Nếu audio im lặng hoặc không có giọng nói, PHẢI trả về score: 0, transcript: "".
${plainContext ? `\nNGỮ CẢNH:\n"""\n${plainContext}\n"""` : ''}
CÂU HỎI: """${questionText}"""
MỤC ĐÍCH: ${purpose}
${specialRequirement ? `\nYÊU CẦU ĐẶC BIỆT:\n"""\n${specialRequirement}\n"""` : ''}
${useDefaultCriteria ? `Câu trả lời thiếu thông tin quan trọng: tối đa ${Math.round(maxPoints * 0.55)}-${Math.round(maxPoints * 0.6)}/${maxPoints}.` : 'Chấm theo YÊU CẦU ĐẶC BIỆT.'}
Viết feedback bằng TIẾNG VIỆT. KHÔNG dùng Markdown heading.
Trả về JSON: { "score": number(0-${maxPoints}), "transcript": "...", "feedback": "...", "teacherNote": "..." }`;

    return this.audioEval({
      modelProfile: 'STANDARD',
      systemPrompt,
      userContent: 'Nghe bản thu âm và chấm điểm. Nếu im lặng: score=0, transcript="".',
      audio,
      mimeType,
      responseFormat: 'json_object',
    });
  }

  async evaluatePronunciation(params: {
    audio: string;
    mimeType?: string;
    targetWord: string;
    targetIpa?: string;
  }): Promise<any> {
    const { audio, mimeType = 'audio/webm', targetWord, targetIpa = '' } = params;

    const systemPrompt = `You are an expert English pronunciation coach. Listen to this audio and evaluate pronunciation quality.
EXPECTED TEXT: "${targetWord}"
EXPECTED IPA: ${targetIpa}
**SILENCE DETECTION:** If audio is silent or no clear speech, return totalScore: 0, transcript: "".
Return JSON ONLY:
{
  "transcript": "exact transcription",
  "totalScore": number(0-100),
  "feedback": { "generalComment": "brief comment" },
  "problemWords": [{"word": "...", "errorPart": "...", "ipa": "/.../", "tip": "..."}],
  "word_letters": [{"letter": "c", "status": "correct"}]
}`;

    return this.audioEval({
      modelProfile: 'STANDARD',
      systemPrompt,
      userContent: 'Evaluate the pronunciation in this audio.',
      audio,
      mimeType,
      responseFormat: 'json_object',
    });
  }

  // ──────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────

  private shuffleChoices(variation: any): any {
    if (!variation || !Array.isArray(variation.options) || variation.options.length < 2) return variation;
    const correctIdx = typeof variation.correctAnswer === 'number' ? variation.correctAnswer : 0;
    const correctOption = variation.options[correctIdx];
    const opts = [...variation.options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    const newCorrectIdx = opts.indexOf(correctOption);
    return { ...variation, options: opts, correctAnswer: newCorrectIdx >= 0 ? newCorrectIdx : 0 };
  }

  private buildGrammarVariationPrompt(
    originalQuestion: any,
    purpose: string,
    type: string,
    settings: any,
    count: number,
  ): string {
    const { targetLevel = 'Không xác định', targetAge = 'Không xác định' } = settings;
    const nCount = count === 1 ? '1 phiên bản mới' : '4 phiên bản (variations)';
    const returnFormat = count === 1
      ? `Trả về kết quả chuẩn JSON (chỉ trả về một Object chứa cấu trúc giống Đề bài gốc).`
      : `Trả về JSON:\n{\n  "improved_original": { /* variation 1 đã sửa */ },\n  "variations": [ /* variation 2 */, /* 3 */, /* 4 */, /* 5 */ ]\n}`;

    return `Bạn là chuyên gia thiết kế bài luyện ngữ pháp tiếng Anh.
Loại câu hỏi: "${type}"
Mục đích: "${purpose}"
Độ tuổi mục tiêu: ${targetAge}
Trình độ mục tiêu: ${targetLevel}

Tạo ${nCount} hoàn toàn mới dựa trên Đề bài gốc.
- Kiểm tra cùng điểm ngữ pháp, mục đích học giống câu gốc.
- Từ vựng phù hợp với độ tuổi và trình độ.
- Giải thích viết bằng TIẾNG VIỆT.
- Giữ nguyên cấu trúc JSON của Đề bài gốc.

${returnFormat}`;
  }

  private buildMockVariations(original: any, count: number): any {
    const variations = Array.from({ length: count }, (_, i) => ({
      ...original,
      text: `[Variation ${i + 2}] ${original.text || ''}`,
    }));
    return { improved_original: original, variations };
  }
}
