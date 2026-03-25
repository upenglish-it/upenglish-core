import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

/**
 * AI Service — NestJS server-side equivalent of api_handler.php + aiService.js + aiGrammarService.js
 *
 * Architecture:
 *   - Model profile: FREE | STANDARD | PREMIUM
 *   - Mode: chat | audio | tts | image_generate | vision
 *   - Provider: google (Gemini) | openrouter
 *   - Waterfall: tries FREE key first, falls back to PAID key
 *
 * All API keys are read from process.env at runtime (set via .superstudy.env)
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /**
   * Promise-based HTTP POST helper (replaces @nestjs/axios)
   */
  private async post<T = any>(url: string, body: any, headers: Record<string, string> = {}): Promise<T> {
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
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const text = Buffer.concat(chunks as unknown as Uint8Array[]).toString();
          try { resolve(JSON.parse(text)); }
          catch { resolve(text as any); }
        });
      });
      req.on('error', reject);
      req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(payload);
      req.end();
    });
  }

  /**
   * GET request (used for TTS scrape)
   */
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
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve({
          buffer: Buffer.concat(chunks as unknown as Uint8Array[]),
          contentType: (res.headers['content-type'] as string) || 'audio/mpeg',
        }));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('TTS request timeout')); });
      req.end();
    });
  }

  // ──────────────────────────────────────────
  // ENV helpers
  // ──────────────────────────────────────────

  private env(key: string): string {
    return process.env[key] || '';
  }

  /**
   * Parse modelProfile + variant (mirrors parseProfileVariant in PHP)
   * Examples:
   *   "STANDARD"         → { profile: "STANDARD", variant: "PRIMARY" }
   *   "STANDARD_BACKUP"  → { profile: "STANDARD", variant: "BACKUP" }
   *   "FREE_BACKUP_2"    → { profile: "FREE",     variant: "BACKUP_2" }
   */
  private parseProfileVariant(profileInput = 'STANDARD'): { profile: string; variant: string } {
    const input = profileInput.toUpperCase();
    const suffixes = ['BACKUP_3', 'BACKUP_2', 'BACKUP'];
    for (const suffix of suffixes) {
      const re = new RegExp(`^(FREE|STANDARD|PREMIUM)_(${suffix})$`);
      const m = input.match(re);
      if (m) return { profile: m[1], variant: m[2] };
    }
    return { profile: input, variant: 'PRIMARY' };
  }

  /**
   * Resolve model config string from env (mirrors getModelConfig in PHP)
   * Returns string in the form "google:gemini-2.0-flash" or "openrouter:model/id"
   */
  private getModelConfig(profileInput = 'STANDARD', mode = 'chat'): string | null {
    const { profile, variant } = this.parseProfileVariant(profileInput);

    let envKey: string;
    switch (mode) {
      case 'vision':      envKey = `${profile}_MEDIA_VISION`;    break;
      case 'tts':         envKey = `${profile}_MEDIA_AUDIO`;     break;
      case 'image_generate': envKey = `${profile}_MEDIA_IMAGE`;  break;
      case 'audio':       envKey = `${profile}_MEDIA_LISTENING`; break;
      default:            envKey = `${profile}_MODEL_${variant}`; break;
    }

    if (this.env(envKey)) return this.env(envKey);

    // Fallbacks (same as PHP)
    if (mode === 'vision' && this.env(`${profile}_MODEL_PRIMARY`)) return this.env(`${profile}_MODEL_PRIMARY`);
    if (mode === 'audio' && this.env(`${profile}_MEDIA_VISION`)) return this.env(`${profile}_MEDIA_VISION`);
    if (mode === 'audio' && this.env(`${profile}_MODEL_PRIMARY`)) return this.env(`${profile}_MODEL_PRIMARY`);
    return null;
  }

  private parseConfig(configStr: string): { provider: string; model: string } {
    if (!configStr.includes(':')) return { provider: 'openrouter', model: configStr };
    const idx = configStr.indexOf(':');
    return { provider: configStr.slice(0, idx).toLowerCase(), model: configStr.slice(idx + 1) };
  }

  private getApiKey(provider: string, usePaid = false): string {
    const keyName = `${provider.toUpperCase()}_API_KEY_${usePaid ? 'PAID' : 'FREE'}`;
    return this.env(keyName);
  }

  // ──────────────────────────────────────────
  // Google Translate TTS (free proxy)
  // ──────────────────────────────────────────

  async gtts(text: string, lang = 'en-US'): Promise<{ success: boolean; audio: string; contentType: string }> {
    if (!text) throw new BadRequestException('Text required');

    let pronText = text.trim();
    if (!/[.!?]$/.test(pronText)) pronText += '.';

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(pronText)}`;

    try {
      const { buffer, contentType } = await this.getBuffer(url);
      const base64 = buffer.toString('base64');
      return { success: true, audio: base64, contentType };
    } catch (err) {
      this.logger.error('Google Translate TTS failed', err);
      throw new ServiceUnavailableException('Failed to fetch from Google TTS');
    }
  }

  // ──────────────────────────────────────────
  // Gemini TTS (mirrors tts mode in PHP)
  // ──────────────────────────────────────────

  async geminiTts(params: {
    modelProfile?: string;
    text: string;
    courseConfig?: { instructions?: string; speed?: number };
    speechConfig?: Record<string, any>;
  }): Promise<{ success: boolean; audio: string; contentType: string }> {
    const configStr = this.getModelConfig(params.modelProfile || 'STANDARD', 'tts');
    if (!configStr) throw new ServiceUnavailableException('No TTS model configured');

    const { provider, model } = this.parseConfig(configStr);
    if (provider !== 'google') throw new BadRequestException('Gemini TTS only supports Google provider');

    // Voice selection logic (mirrors PHP)
    const instructions = params.courseConfig?.instructions || '';
    let speechConfig = params.speechConfig;
    if (!speechConfig) {
      let voiceName = 'Charon';
      const lc = instructions.toLowerCase();
      if (/female|woman|girl/.test(lc)) voiceName = 'Aoede';
      else if (/male|man|boy/.test(lc)) voiceName = 'Charon';
      else if (instructions.includes('7-year-old') || instructions.includes('Beginner')) voiceName = 'Aoede';
      else if (instructions.includes('Business') || instructions.includes('University')) voiceName = 'Aoede';
      speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName } } };
    }

    const apiKey = this.getApiKey('google', false) || this.getApiKey('google', true);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: [{ text: params.text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig },
    };

    const result = await this.callGoogleApi(url, payload);
    const audioBase64 = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) throw new ServiceUnavailableException('No audio in Gemini TTS response');
    return { success: true, audio: audioBase64, contentType: 'audio/wav' };
  }

  // ──────────────────────────────────────────
  // Chat completion
  // ──────────────────────────────────────────

  async chat(params: {
    modelProfile?: string;
    systemPrompt?: string;
    userContent: string;
    responseFormat?: string;
    thinkingLevel?: string;
  }): Promise<{ choices: Array<{ message: { content: string } }> }> {
    const configStr = this.getModelConfig(params.modelProfile || 'STANDARD', 'chat');
    if (!configStr) throw new ServiceUnavailableException('No chat model configured');

    const { provider, model } = this.parseConfig(configStr);
    const useJson = params.responseFormat === 'json_object' || params.responseFormat === 'json';

    if (provider === 'google') {
      return this.callGoogleChat({ model, params, useJson });
    }
    return this.callOpenRouterChat({ model, params, useJson });
  }

  private async callGoogleChat(opts: {
    model: string;
    params: { systemPrompt?: string; userContent: string; thinkingLevel?: string };
    useJson: boolean;
  }) {
    const apiKey = this.getApiKey('google', false) || this.getApiKey('google', true);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent?key=${apiKey}`;

    const contents: any[] = [];
    if (opts.params.systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: opts.params.systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: '.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: opts.params.userContent }] });

    const payload: any = { contents };
    if (opts.useJson) payload.generationConfig = { responseMimeType: 'application/json' };
    if (opts.params.thinkingLevel) payload.generationConfig = { ...(payload.generationConfig || {}), thinkingConfig: { thinkingBudget: opts.params.thinkingLevel === 'HIGH' ? 8192 : 2048 } };

    const result = await this.callGoogleApiWithFallback(url, opts.model, payload);
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { choices: [{ message: { content: text } }] };
  }

  private async callOpenRouterChat(opts: {
    model: string;
    params: { systemPrompt?: string; userContent: string };
    useJson: boolean;
  }) {
    const apiKey = this.getApiKey('openrouter', false) || this.getApiKey('openrouter', true);
    const messages: any[] = [];
    if (opts.params.systemPrompt) messages.push({ role: 'system', content: opts.params.systemPrompt });
    messages.push({ role: 'user', content: opts.params.userContent });

    const body: any = { model: opts.model, messages };
    if (opts.useJson) body.response_format = { type: 'json_object' };

    return this.post('https://openrouter.ai/api/v1/chat/completions', body, {
      Authorization: `Bearer ${apiKey}`,
    });
  }

  // ──────────────────────────────────────────
  // Audio evaluation (pronunciation / grading)
  // ──────────────────────────────────────────

  async audioEval(params: {
    modelProfile?: string;
    systemPrompt: string;
    userContent: string;
    audio: string;
    mimeType?: string;
    responseFormat?: string;
  }): Promise<any> {
    const configStr = this.getModelConfig(params.modelProfile || 'STANDARD', 'audio');
    if (!configStr) throw new ServiceUnavailableException('No audio model configured');

    const { provider, model } = this.parseConfig(configStr);
    if (provider !== 'google') throw new BadRequestException('Audio eval only supports Google Gemini provider');

    const apiKey = this.getApiKey('google', false) || this.getApiKey('google', true);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const mimeType = params.mimeType || 'audio/webm';

    const contents: any[] = [
      {
        role: 'user',
        parts: [
          { text: params.systemPrompt },
          { inlineData: { mimeType, data: params.audio } },
          { text: params.userContent },
        ],
      },
    ];

    const payload: any = { contents };
    if (params.responseFormat === 'json_object') {
      payload.generationConfig = { responseMimeType: 'application/json' };
    }

    const result = await this.callGoogleApiWithFallback(url, model, payload);
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to parse JSON from response
    try {
      const cleaned = text.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      return { score: 50, transcript: '(Parse error)', feedback: text };
    }
  }

  // ──────────────────────────────────────────
  // Image generation (Imagen)
  // ──────────────────────────────────────────

  async imageGenerate(params: { modelProfile?: string; prompt: string }): Promise<any> {
    const configStr = this.getModelConfig(params.modelProfile || 'STANDARD', 'image_generate');
    if (!configStr) throw new ServiceUnavailableException('No image generation model configured');

    const { model } = this.parseConfig(configStr);
    const apiKey = this.getApiKey('google', false) || this.getApiKey('google', true);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const payload = { instances: [{ prompt: params.prompt }], parameters: { sampleCount: 1 } };
    return this.callGoogleApi(url, payload);
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
    const { targetLevel = 'Không xác định', targetAge = 'Không xác định' } = settings as any;

    const systemPrompt = this.buildGrammarVariationPrompt(params.originalQuestion, params.purpose, type, settings, 4);
    const userContent = `Đề bài gốc (Variation 1):\n${JSON.stringify(params.originalQuestion, null, 2)}`;

    const result = await this.chat({
      systemPrompt,
      userContent,
      responseFormat: 'json',
      thinkingLevel: 'high',
    });
    const text = result.choices[0].message.content;
    const data = JSON.parse(text);

    if (data.improved_original && Array.isArray(data.variations) && data.variations.length >= 4) {
      if (type === 'multiple_choice') {
        data.improved_original = this.shuffleChoices(data.improved_original);
        data.variations = data.variations.map((v: any) => this.shuffleChoices(v));
      }
      return data;
    }
    // Fallback
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

    const result = await this.chat({ systemPrompt, userContent, responseFormat: 'json', thinkingLevel: 'high' });
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

    // Build the same system prompt as aiGrammarService.js gradeGrammarSubmissionWithAI
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

    const result = await this.chat({ systemPrompt, userContent, responseFormat: 'json', thinkingLevel: 'high' });
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

    const result = await this.chat({ systemPrompt, userContent: 'Đánh giá từng chỗ trống.', responseFormat: 'json' });
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

    const result = await this.chat({ systemPrompt, userContent: 'Classify this question.', responseFormat: 'json' });
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

    // Simplified version of the full prompt in aiService.js
    const systemPrompt = `You are an expert English pronunciation coach. Listen to this audio and evaluate pronunciation quality.
EXPECTED TEXT: "${targetWord}"
EXPECTED IPA: ${targetIpa}
**SILENCE DETECTION:** If audio is silent or no clear speech, return totalScore: 0, transcript: "".
Return JSON ONLY:
{
  "transcript": "exact transcription",
  "totalScore": number(0-100),
  "feedback": { "generalComment": "brief comment" },
  "problemWords": [{"word": "...", "errorPart": "...", "ipa": "/.../" , "tip": "..."}],
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

  private async callGoogleApi(url: string, payload: any): Promise<any> {
    return this.post(url, payload);
  }

  /**
   * Waterfall: FREE key → PAID key (mirrors PHP logic)
   */
  private async callGoogleApiWithFallback(url: string, _model: string, payload: any): Promise<any> {
    const freeKey = this.getApiKey('google', false);
    const paidKey = this.getApiKey('google', true);

    const tryKey = (key: string) => {
      const keyedUrl = url.replace(/key=[^&]*/, `key=${key}`);
      return this.post(keyedUrl, payload);
    };

    try {
      if (freeKey) return await tryKey(freeKey);
    } catch (err) {
      this.logger.warn('Google free key failed, falling back to paid key');
    }

    if (paidKey) return tryKey(paidKey);

    throw new ServiceUnavailableException('No valid Google API key available');
  }

  /** Shuffle MCQ options so correct answer isn't always at index 0 (mirrors aiGrammarService) */
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

  /** Build grammar variation system prompt (shared by generate-variations and generate-single) */
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
      : `Trả về JSON:
{
  "improved_original": { /* variation 1 đã sửa */ },
  "variations": [ /* variation 2 */, /* 3 */, /* 4 */, /* 5 */ ]
}`;

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
