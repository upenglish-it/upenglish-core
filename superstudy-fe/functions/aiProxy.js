/**
 * AI Proxy Cloud Function (2nd Gen)
 * ────────────────────────────────────────────────────────
 * Rewrite of api_handler.php into Firebase Cloud Functions.
 * 
 * Features:
 *  - CORS handling (automatic via onRequest)
 *  - Strict Waterfall: Always Try Free Key → Fallback to Paid Key
 *  - Media Guard: Blocks media requests for FREE profile if disabled
 *  - Google Native: Supports Gemini (Chat/Vision/Audio/TTS), Imagen
 *  - Audio Support: Full Gemini Audio (Input & Output)
 *  - Model Variant Support (BACKUP, BACKUP_2, BACKUP_3)
 *  - PCM → WAV conversion for Gemini TTS
 *  - Multi-speaker TTS support
 *  - Thinking mode support
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

// ─── Secrets (stored via `firebase functions:secrets:set`) ───
const GOOGLE_API_KEY_FREE = defineSecret("GOOGLE_API_KEY_FREE");
const GOOGLE_API_KEY_PAID = defineSecret("GOOGLE_API_KEY_PAID");
const OPENROUTER_API_KEY_FREE = defineSecret("OPENROUTER_API_KEY_FREE");
const OPENROUTER_API_KEY_PAID = defineSecret("OPENROUTER_API_KEY_PAID");
const HF_API_TOKEN = defineSecret("HF_API_TOKEN");

// ─── Model config (loaded from Firestore app_config/ai_models) ───
let cachedModelConfig = null;
let modelConfigTimestamp = 0;
const MODEL_CONFIG_TTL = 5 * 60 * 1000; // Cache for 5 minutes

async function getModelConfig() {
    const now = Date.now();
    if (cachedModelConfig && (now - modelConfigTimestamp) < MODEL_CONFIG_TTL) {
        return cachedModelConfig;
    }

    try {
        const db = admin.firestore();
        const doc = await db.collection("app_config").doc("ai_models").get();
        if (doc.exists) {
            cachedModelConfig = doc.data();
            modelConfigTimestamp = now;
            return cachedModelConfig;
        }
    } catch (e) {
        console.warn("Failed to load model config from Firestore:", e.message);
    }

    // Fallback defaults
    if (!cachedModelConfig) {
        cachedModelConfig = {
            FREE_MODEL_PRIMARY: "google:gemini-2.5-flash-lite",
            FREE_MODEL_BACKUP: "openrouter:meta-llama/llama-3.3-70b-instruct:free",
            FREE_MEDIA_ENABLED: "false",

            STANDARD_MODEL_PRIMARY: "google:gemini-3-flash-preview",
            STANDARD_MODEL_BACKUP: "google:gemini-2.5-flash-lite",
            STANDARD_MEDIA_VISION: "google:gemini-3-flash-preview",
            STANDARD_MEDIA_AUDIO: "google:gemini-2.5-flash-preview-tts",
            STANDARD_MEDIA_IMAGE: "google:imagen-4.0-fast-generate-001",
            STANDARD_MEDIA_LISTENING: "google:gemini-3-flash-preview",

            PREMIUM_MODEL_PRIMARY: "google:gemini-3.1-pro-preview",
            PREMIUM_MODEL_BACKUP: "openrouter:anthropic/claude-sonnet-4.6",
            PREMIUM_MEDIA_VISION: "google:gemini-2.5-pro",
            PREMIUM_MEDIA_AUDIO: "google:gemini-2.5-flash-preview-tts",
            PREMIUM_MEDIA_IMAGE: "google:imagen-4.0-generate-001",
            PREMIUM_MEDIA_LISTENING: "google:gemini-3.1-pro-preview",
        };
        modelConfigTimestamp = now;
    }
    return cachedModelConfig;
}

// ════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════

/**
 * Parse profile to extract base profile and variant.
 * "STANDARD" → { profile: "STANDARD", variant: "PRIMARY" }
 * "STANDARD_BACKUP" → { profile: "STANDARD", variant: "BACKUP" }
 * "FREE_BACKUP_2" → { profile: "FREE", variant: "BACKUP_2" }
 */
function parseProfileVariant(profileInput) {
    const upper = (profileInput || "FREE").toUpperCase();
    const match3 = upper.match(/^(FREE|STANDARD|PREMIUM)_(BACKUP_3)$/);
    if (match3) return { profile: match3[1], variant: match3[2] };
    const match2 = upper.match(/^(FREE|STANDARD|PREMIUM)_(BACKUP_2)$/);
    if (match2) return { profile: match2[1], variant: match2[2] };
    const match1 = upper.match(/^(FREE|STANDARD|PREMIUM)_(BACKUP)$/);
    if (match1) return { profile: match1[1], variant: match1[2] };
    // Check base profiles
    if (["FREE", "STANDARD", "PREMIUM"].includes(upper)) {
        return { profile: upper, variant: "PRIMARY" };
    }
    return { profile: upper, variant: "PRIMARY" };
}

/**
 * Get model config string based on profile + mode.
 */
async function resolveModelConfig(profileInput, mode) {
    const config = await getModelConfig();
    const { profile, variant } = parseProfileVariant(profileInput);

    // Media guard for FREE
    if (profile === "FREE" && mode !== "chat") {
        const enabled = config.FREE_MEDIA_ENABLED || "false";
        if (enabled === "false") {
            throw { code: 403, message: "Media features (Audio/Vision/Image) are disabled for FREE tier." };
        }
    }

    let envKey = "";
    switch (mode) {
        case "vision": envKey = `${profile}_MEDIA_VISION`; break;
        case "tts": envKey = `${profile}_MEDIA_AUDIO`; break;
        case "image_generate": envKey = `${profile}_MEDIA_IMAGE`; break;
        case "audio": envKey = `${profile}_MEDIA_LISTENING`; break;
        case "file_chat":
        case "chat":
        default:
            envKey = `${profile}_MODEL_${variant}`;
            break;
    }

    if (config[envKey]) return config[envKey];

    // Fallbacks
    if (mode === "vision" && config[`${profile}_MODEL_PRIMARY`]) return config[`${profile}_MODEL_PRIMARY`];
    if (mode === "audio" && config[`${profile}_MEDIA_VISION`]) return config[`${profile}_MEDIA_VISION`];
    if (mode === "audio" && config[`${profile}_MODEL_PRIMARY`]) return config[`${profile}_MODEL_PRIMARY`];

    return null;
}

function parseProviderModel(configStr) {
    if (!configStr || !configStr.includes(":")) return { provider: "openrouter", model: configStr };
    const idx = configStr.indexOf(":");
    return { provider: configStr.substring(0, idx).toLowerCase(), model: configStr.substring(idx + 1) };
}

function getApiKey(provider, usePaid = false) {
    const p = provider.toUpperCase();
    if (p === "GOOGLE") {
        return usePaid ? GOOGLE_API_KEY_PAID.value() : GOOGLE_API_KEY_FREE.value();
    }
    if (p === "OPENROUTER") {
        return usePaid ? OPENROUTER_API_KEY_PAID.value() : OPENROUTER_API_KEY_FREE.value();
    }
    return "";
}

/**
 * Convert raw PCM (Gemini 24kHz, 16-bit mono) to WAV.
 */
function pcmToWav(pcmBuffer) {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataLen = pcmBuffer.length;
    const totalLen = 36 + dataLen;

    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(totalLen, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20);  // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataLen, 40);

    return Buffer.concat([header, pcmBuffer]);
}

// ════════════════════════════════════════════════════════
// CORE API CALL
// ════════════════════════════════════════════════════════

async function callApiProvider(provider, model, apiKey, system, user, format, mode, mediaData, mimeType, input) {
    let url = "";
    let headers = {};
    let body = {};
    let isBinaryResponse = false;

    // ─── GOOGLE PROVIDER ───
    if (provider === "google") {

        // A. TTS
        if (mode === "tts") {
            if (model.toLowerCase().includes("gemini")) {
                // Gemini Audio Generation
                url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                headers = { "Content-Type": "application/json" };

                let speechConfig = null;
                if (input.speechConfig) {
                    speechConfig = input.speechConfig;
                } else {
                    let voiceName = "Charon";
                    const instructions = input.courseConfig?.instructions || "";
                    const lcInstr = instructions.toLowerCase();
                    if (lcInstr.includes("female") || lcInstr.includes("woman") || lcInstr.includes("girl")) {
                        voiceName = "Aoede";
                    } else if (lcInstr.includes("male") || lcInstr.includes("man") || lcInstr.includes("boy")) {
                        voiceName = "Charon";
                    } else {
                        if (instructions.includes("7-year-old")) voiceName = "Aoede";
                        else if (instructions.includes("Beginner")) voiceName = "Aoede";
                        else if (instructions.includes("Intermediate")) voiceName = "Charon";
                        else if (instructions.includes("Business")) voiceName = "Aoede";
                        else if (instructions.includes("University")) voiceName = "Aoede";
                        else if (instructions.includes("Fluent")) voiceName = "Charon";
                    }
                    speechConfig = {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName } }
                    };
                }

                body = {
                    contents: [{ parts: [{ text: user }] }],
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig
                    }
                };
            } else {
                // Legacy Google Cloud TTS
                url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
                headers = { "Content-Type": "application/json" };

                let speakingRate = 1.0;
                if (input.courseConfig?.speed) {
                    speakingRate = Math.max(0.25, Math.min(4.0, parseFloat(input.courseConfig.speed)));
                }

                let voiceParams = { languageCode: "en-US", name: "en-US-Studio-O" };
                const instructions = input.courseConfig?.instructions || "";

                if (instructions.includes("7-year-old") || instructions.includes("children")) {
                    voiceParams = { languageCode: "en-US", name: "en-US-Journey-F" };
                } else if (instructions.includes("Beginner learners") || instructions.includes("survival English")) {
                    voiceParams = { languageCode: "en-GB", name: "en-GB-Neural2-A" };
                } else if (instructions.includes("Intermediate learners") || instructions.includes("Narrative")) {
                    voiceParams = { languageCode: "en-GB", name: "en-GB-Neural2-B" };
                } else if (instructions.includes("Business professionals") || instructions.includes("Professional")) {
                    voiceParams = { languageCode: "en-US", name: "en-US-Studio-O" };
                } else if (instructions.includes("University students") || instructions.includes("Academic")) {
                    voiceParams = { languageCode: "en-AU", name: "en-AU-Neural2-A" };
                } else if (instructions.includes("Fluent speakers") || instructions.includes("casual")) {
                    voiceParams = { languageCode: "en-US", name: "en-US-Neural2-J" };
                } else if (model.includes("journey")) {
                    voiceParams = { languageCode: "en-US", name: "en-US-Journey-F" };
                }

                body = {
                    input: { text: user },
                    voice: voiceParams,
                    audioConfig: { audioEncoding: "MP3", speakingRate }
                };
            }
        }

        // B. Image Generation (Imagen)
        else if (mode === "image_generate") {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
            headers = { "Content-Type": "application/json" };
            body = {
                instances: [{ prompt: user }],
                parameters: { sampleCount: 1, aspectRatio: "1:1" }
            };
        }

        // C. Audio Listening (Pronunciation Analysis)
        else if (mode === "audio") {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            headers = { "Content-Type": "application/json" };

            if (!mediaData) throw new Error("Audio data required for listening mode.");
            const audioMimeType = mimeType || "audio/webm";

            const parts = [];
            if (system) parts.push({ text: system });
            if (user) parts.push({ text: user });
            parts.push({ inline_data: { mime_type: audioMimeType, data: mediaData } });

            const payload = { contents: [{ role: "user", parts }] };
            if (format === "json_object") {
                payload.generationConfig = { responseMimeType: "application/json" };
            }
            body = payload;
        }

        // D. Chat, Vision & File Chat
        else {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            headers = { "Content-Type": "application/json" };

            const parts = [];
            if (user) parts.push({ text: user });

            if (mode === "vision" && mediaData) {
                const imageMimeType = mimeType || "image/jpeg";
                parts.push({ inline_data: { mime_type: imageMimeType, data: mediaData } });
            }

            // File Chat: attach file (PDF, image, etc.) as inline_data
            if (mode === "file_chat" && mediaData) {
                const fileMime = mimeType || "application/pdf";
                parts.push({ inline_data: { mime_type: fileMime, data: mediaData } });
            }

            const payload = { contents: [{ role: "user", parts }] };
            if (system) {
                payload.system_instruction = { parts: { text: system } };
            }

            const genConfig = {};
            if (format === "json_object") genConfig.responseMimeType = "application/json";
            if (input.thinkingLevel) {
                genConfig.thinkingConfig = { thinkingLevel: input.thinkingLevel.toUpperCase() };
            }
            if (Object.keys(genConfig).length > 0) payload.generationConfig = genConfig;

            body = payload;
        }
    }

    // ─── OPENROUTER PROVIDER ───
    else {
        headers = {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://upenglishvietnam.com",
            "X-Title": "UpEnglish AI"
        };

        if (mode === "audio") {
            throw new Error("Audio listening mode is only supported with Google Gemini. Please configure MEDIA_LISTENING with 'google:' prefix.");
        }

        if (mode === "tts") {
            url = "https://openrouter.ai/api/v1/audio/speech";
            let speed = 1.0;
            if (input.courseConfig?.speed) speed = parseFloat(input.courseConfig.speed);
            body = { model, input: user, voice: "alloy", speed };
            isBinaryResponse = true;
        } else if (mode === "image_generate") {
            url = "https://openrouter.ai/api/v1/images/generations";
            body = { model, prompt: user, n: 1, size: "1024x1024" };
        } else {
            url = "https://openrouter.ai/api/v1/chat/completions";
            let userContent = user;
            if (mode === "vision" && mediaData) {
                const imageMimeType = mimeType || "image/jpeg";
                userContent = [
                    { type: "text", text: user },
                    { type: "image_url", image_url: { url: `data:${imageMimeType};base64,${mediaData}` } }
                ];
            }
            const messages = [];
            if (system) messages.push({ role: "system", content: system });
            messages.push({ role: "user", content: userContent });
            body = { model, messages };
            if (format === "json_object") body.response_format = { type: "json_object" };
        }
    }

    // ─── EXECUTE FETCH ───
    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(110000) // 110s timeout (slightly under Cloud Function 120s limit)
    });

    const httpCode = response.status;

    if (httpCode !== 200) {
        let msg = "";
        try {
            const errData = await response.json();
            msg = errData.error?.message || JSON.stringify(errData);
        } catch {
            msg = await response.text();
        }
        if (httpCode === 429) throw new Error("QUOTA_EXCEEDED");
        throw new Error(`API Error ${httpCode}: ${msg}`);
    }

    // ─── NORMALIZE OUTPUT ───

    // 1. TTS Audio Output
    if (mode === "tts") {
        if (provider === "google") {
            const jsonResp = await response.json();

            // Gemini Audio (PCM)
            if (jsonResp.candidates?.[0]?.content?.parts) {
                for (const part of jsonResp.candidates[0].content.parts) {
                    if (part.inlineData?.data) {
                        const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
                        const wavBuffer = pcmToWav(pcmBuffer);
                        return { type: "audio", data: wavBuffer, contentType: "audio/wav" };
                    }
                }
            }

            // Legacy TTS (MP3)
            if (jsonResp.audioContent) {
                return { type: "audio", data: Buffer.from(jsonResp.audioContent, "base64"), contentType: "audio/mpeg" };
            }
            throw new Error("Google TTS missing audioContent or inlineData");
        } else {
            // OpenRouter returns raw audio bytes
            const arrayBuffer = await response.arrayBuffer();
            return { type: "audio", data: Buffer.from(arrayBuffer), contentType: "audio/mpeg" };
        }
    }

    const jsonResp = await response.json();

    // 2. Image Output
    if (mode === "image_generate") {
        if (provider === "google") {
            if (jsonResp.predictions?.[0]?.bytesBase64Encoded) {
                return { type: "image", data: jsonResp.predictions[0].bytesBase64Encoded, format: "base64" };
            }
        } else {
            if (jsonResp.data?.[0]?.url) return { type: "image", data: jsonResp.data[0].url, format: "url" };
            if (jsonResp.data?.[0]?.b64_json) return { type: "image", data: jsonResp.data[0].b64_json, format: "base64" };
        }
    }

    // 3. Text/Chat/Audio Analysis Output — normalize to OpenAI structure
    if (provider === "google") {
        let text = "";
        if (jsonResp.candidates?.[0]?.content?.parts) {
            for (const part of jsonResp.candidates[0].content.parts) {
                if (part.thought === true) continue; // Skip thinking parts
                text += part.text || "";
            }
        }
        // Clean <think>...</think> tags
        text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
        return { choices: [{ message: { content: text.trim() } }] };
    }

    // Clean OpenRouter thinking tags
    if (jsonResp.choices?.[0]?.message?.content) {
        const content = jsonResp.choices[0].message.content;
        if (content.includes("<think>")) {
            jsonResp.choices[0].message.content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        }
    }

    return jsonResp;
}

// ════════════════════════════════════════════════════════
// WATERFALL: Free Key → Paid Key
// ════════════════════════════════════════════════════════

async function attemptGeneration(configStr, system, user, format, mode, mediaData, mimeType, input) {
    const { provider, model } = parseProviderModel(configStr);

    try {
        const keyFree = getApiKey(provider, false);
        if (!keyFree) throw new Error(`No Free Key configured for ${provider}`);
        return await callApiProvider(provider, model, keyFree, system, user, format, mode, mediaData, mimeType, input);
    } catch (e) {
        // Check if eligible for paid retry
        let shouldRetryPaid = true;
        if (provider === "openrouter" && model.includes(":free")) shouldRetryPaid = false;

        if (shouldRetryPaid) {
            const keyPaid = getApiKey(provider, true);
            if (keyPaid) {
                return await callApiProvider(provider, model, keyPaid, system, user, format, mode, mediaData, mimeType, input);
            }
        }
        throw e;
    }
}

// ════════════════════════════════════════════════════════
// SPECIAL ROUTE: Google Translate TTS Proxy
// ════════════════════════════════════════════════════════

async function handleGtts(text, lang) {
    if (!text) throw { code: 400, message: "Text required" };

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(lang || "en-US")}&q=${encodeURIComponent(text)}`;

    const response = await fetch(ttsUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        throw { code: 502, message: `Failed to fetch audio from Google TTS (HTTP ${response.status})` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "audio/mpeg";

    return {
        success: true,
        audio: audioBuffer.toString("base64"),
        contentType
    };
}

// ════════════════════════════════════════════════════════
// MAIN REQUEST HANDLER
// ════════════════════════════════════════════════════════

async function processRequest(input, res) {
    try {
        // Special route: gtts
        if (input.action === "gtts") {
            const result = await handleGtts(input.text, input.lang);
            return res.json(result);
        }

        // Special route: Hugging Face image generation
        if (input.action === "hf_image") {
            const hfToken = HF_API_TOKEN.value();
            if (!hfToken) throw { code: 500, message: "HF_API_TOKEN not configured." };

            const model = input.model || "black-forest-labs/FLUX.1-schnell";
            const prompt = input.prompt;
            if (!prompt) throw { code: 400, message: "Prompt required for hf_image." };

            const hfResponse = await fetch(
                `https://router.huggingface.co/hf-inference/models/${model}`,
                {
                    method: "POST",
                    headers: { Authorization: `Bearer ${hfToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ inputs: prompt }),
                    signal: AbortSignal.timeout(60000)
                }
            );

            if (!hfResponse.ok) {
                const errText = await hfResponse.text();
                throw { code: hfResponse.status, message: `HF API Error: ${errText}` };
            }

            const arrayBuffer = await hfResponse.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            return res.json({ success: true, image: base64, contentType: hfResponse.headers.get("content-type") || "image/jpeg" });
        }

        const profile = input.modelProfile || "FREE";
        const mode = input.mode || "chat";

        // 1. Get model config
        const configStr = await resolveModelConfig(profile, mode);
        if (!configStr) {
            const { profile: baseProfile } = parseProfileVariant(profile);
            if (baseProfile === "FREE") {
                throw { code: 403, message: "Feature disabled or not configured for FREE tier." };
            }
            throw { code: 500, message: `Missing configuration for ${profile} / ${mode}` };
        }

        const system = input.systemPrompt || "";
        const user = input.userContent || "";
        const format = input.responseFormat || null;

        // Media data
        let mediaData = null;
        let mimeType = null;

        if (mode === "vision") {
            mediaData = input.image || null;
            mimeType = input.mimeType || "image/jpeg";
            if (!mediaData) throw { code: 400, message: "Image data required for vision mode." };
        } else if (mode === "audio") {
            mediaData = input.audio || null;
            mimeType = input.mimeType || "audio/webm";
            if (!mediaData) throw { code: 400, message: "Audio data required for audio listening mode." };
        } else if (mode === "file_chat") {
            mediaData = input.fileData || null;
            mimeType = input.fileMimeType || "application/pdf";
            if (!mediaData) throw { code: 400, message: "File data required for file_chat mode." };
        }

        // 2. Execute waterfall
        const result = await attemptGeneration(configStr, system, user, format, mode, mediaData, mimeType, input);

        // 3. Return result
        if (mode === "tts" && result?.type === "audio") {
            res.set("Content-Type", result.contentType || "audio/mpeg");
            return res.send(result.data);
        } else if (mode === "image_generate" && result?.type === "image") {
            return res.json(result);
        } else {
            return res.json(result);
        }

    } catch (e) {
        const message = e.message || String(e);
        let code = e.code || 500;
        if (typeof code !== "number") code = 500;
        if (message === "QUOTA_EXCEEDED") code = 429;
        if (message.includes("disabled")) code = 403;
        if (message.includes("only supported")) code = 400;

        console.error("AI Proxy Error:", message);
        res.status(code).json({ error: { message } });
    }
}

// ════════════════════════════════════════════════════════
// EXPORTED CLOUD FUNCTION (2nd Gen)
// ════════════════════════════════════════════════════════

exports.aiProxy = onRequest(
    {
        region: "asia-southeast1",
        timeoutSeconds: 120,
        memory: "512MiB",
        maxInstances: 100,
        concurrency: 80,
        cors: true,
        secrets: [GOOGLE_API_KEY_FREE, GOOGLE_API_KEY_PAID, OPENROUTER_API_KEY_FREE, OPENROUTER_API_KEY_PAID, HF_API_TOKEN],
    },
    async (req, res) => {
        // Only allow POST
        if (req.method !== "POST") {
            return res.status(405).json({ error: "POST required" });
        }

        const input = req.body;
        if (!input || typeof input !== "object") {
            return res.status(400).json({ error: "Invalid JSON body" });
        }

        await processRequest(input, res);
    }
);
