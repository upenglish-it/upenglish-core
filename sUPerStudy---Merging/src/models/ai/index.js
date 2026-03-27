import { api } from "../httpClient";

// ── AI Service ──────────────────────────────────────────────────────────────
const BASE = "/ai";

export const aiService = {
  /** Text chat completion (routes to Gemini or OpenRouter based on modelProfile) */
  chat: (body) =>
    api.post(`${BASE}/chat`, body),

  /** Audio evaluation — pronunciation or speaking grading (Gemini audio mode) */
  audioEval: (body) =>
    api.post(`${BASE}/audio-eval`, body),

  /** Google Translate TTS proxy — returns base64 audio blob */
  tts: (body) =>
    api.post(`${BASE}/tts`, body),

  /** Google Cloud TTS (Gemini or Standard) — returns base64 audio blob */
  geminiTts: (body) =>
    api.post(`${BASE}/tts/gemini`, body),

  /** Image generation via Google Imagen */
  imageGenerate: (body) =>
    api.post(`${BASE}/image-generate`, body),

  /** Generate 4 grammar question variations + improved original */
  generateGrammarVariations: (body) =>
    api.post(`${BASE}/grammar/generate-variations`, body),

  /** Generate 1 single new grammar question variation */
  generateSingleGrammarVariation: (body) =>
    api.post(`${BASE}/grammar/generate-single-variation`, body),

  /** Grade a student's written/typed grammar answer with AI */
  gradeGrammar: (body) =>
    api.post(`${BASE}/grammar/grade`, body),

  /** AI-grade fill-in-blank typing blanks (lightweight — returns boolean[]) */
  gradeFillInBlank: (body) =>
    api.post(`${BASE}/grammar/grade-fill-in-blank`, body),

  /** Classify error category for a grammar question */
  classifyError: (body) =>
    api.post(`${BASE}/grammar/classify-error`, body),

  /** Grade audio answer for exam/grammar questions */
  gradeAudio: (body) =>
    api.post(`${BASE}/audio-grade`, body),

  /** Evaluate pronunciation from audio (returns score, transcript, feedback) */
  evaluatePronunciation: (body) =>
    api.post(`${BASE}/pronunciation-eval`, body),
};
