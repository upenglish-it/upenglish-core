import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { SSTAppConfig } from 'apps/common/src/database/mongodb/src/superstudy';

/** TTL for in-memory model config cache (5 minutes — mirrors aiProxy.js MODEL_CONFIG_TTL) */
const MODEL_CONFIG_TTL_MS = 5 * 60 * 1000;

/** The fixed document ID for AI model config — mirrors Firestore doc path app_config/ai_models */
const AI_MODELS_DOC_ID = 'ai_models';

/**
 * Default fallback model config — mirrors aiProxy.js hardcoded defaults.
 * These are used when the database document is not found/empty AND the env var is not set.
 */
const DEFAULT_MODEL_CONFIG: Record<string, string> = {
  FREE_MODEL_PRIMARY: 'google:gemini-2.5-flash-lite',
  FREE_MODEL_BACKUP: 'openrouter:meta-llama/llama-3.3-70b-instruct:free',
  FREE_MEDIA_ENABLED: 'false',

  STANDARD_MODEL_PRIMARY: 'google:gemini-3-flash-preview',
  STANDARD_MODEL_BACKUP: 'google:gemini-2.5-flash-lite',
  STANDARD_MEDIA_VISION: 'google:gemini-3-flash-preview',
  STANDARD_MEDIA_AUDIO: 'google:gemini-2.5-flash-preview-tts',
  STANDARD_MEDIA_IMAGE: 'google:imagen-4.0-fast-generate-001',
  STANDARD_MEDIA_LISTENING: 'google:gemini-3-flash-preview',

  PREMIUM_MODEL_PRIMARY: 'google:gemini-3.1-pro-preview',
  PREMIUM_MODEL_BACKUP: 'openrouter:anthropic/claude-sonnet-4.6',
  PREMIUM_MEDIA_VISION: 'google:gemini-2.5-pro',
  PREMIUM_MEDIA_AUDIO: 'google:gemini-2.5-flash-preview-tts',
  PREMIUM_MEDIA_IMAGE: 'google:imagen-4.0-generate-001',
  PREMIUM_MEDIA_LISTENING: 'google:gemini-3.1-pro-preview',
};

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);

  /** In-memory cache: { data, cachedAt } */
  private aiModelCache: { data: Record<string, string>; cachedAt: number } | null = null;

  constructor(
    @InjectModel(SSTAppConfig)
    private readonly appConfigModel: ReturnModelType<typeof SSTAppConfig>,
  ) {}

  // ──────────────────────────────────────────
  // Generic CRUD
  // ──────────────────────────────────────────

  /** Get any app_config document by its ID */
  async getConfig(docId: string): Promise<Record<string, any>> {
    const doc = await this.appConfigModel.findById(docId).lean();
    if (!doc) throw new NotFoundException(`AppConfig "${docId}" not found`);
    return (doc as any).data ?? {};
  }

  /** Upsert a config document */
  async setConfig(docId: string, data: Record<string, any>, description?: string) {
    const updated = await this.appConfigModel.findByIdAndUpdate(
      docId,
      { $set: { data, ...(description ? { description } : {}) } },
      { upsert: true, new: true },
    ).lean();

    // Bust cache if updating ai_models
    if (docId === AI_MODELS_DOC_ID) {
      this.aiModelCache = null;
    }

    return (updated as any)?.data ?? {};
  }

  /** Patch specific keys on a config document */
  async patchConfig(docId: string, patch: Record<string, any>) {
    const setFields: Record<string, any> = {};
    for (const [k, v] of Object.entries(patch)) {
      setFields[`data.${k}`] = v;
    }
    const updated = await this.appConfigModel.findByIdAndUpdate(
      docId,
      { $set: setFields },
      { upsert: true, new: true },
    ).lean();

    if (docId === AI_MODELS_DOC_ID) {
      this.aiModelCache = null;
    }

    return (updated as any)?.data ?? {};
  }

  // ──────────────────────────────────────────
  // AI Model Config (primary use-case)
  // Mirrors aiProxy.js getModelConfig() with 5-min cache
  // ──────────────────────────────────────────

  /**
   * Get the merged AI model config.
   * Priority: MongoDB doc (if found) → env vars → hardcoded defaults.
   * Cached for 5 minutes (mirrors original Cloud Function behavior).
   */
  async getAiModelConfig(): Promise<Record<string, string>> {
    const now = Date.now();

    if (this.aiModelCache && (now - this.aiModelCache.cachedAt) < MODEL_CONFIG_TTL_MS) {
      return this.aiModelCache.data;
    }

    let dbData: Record<string, string> = {};
    try {
      const doc = await this.appConfigModel.findById(AI_MODELS_DOC_ID).lean();
      if (doc && (doc as any).data) {
        dbData = (doc as any).data as Record<string, string>;
      }
    } catch (err) {
      this.logger.warn('Failed to load AI model config from MongoDB, using env/defaults:', err?.message);
    }

    // Merge: DB values override defaults; env vars override DB values
    // (env vars take highest priority to allow deployment-time overrides)
    const merged: Record<string, string> = { ...DEFAULT_MODEL_CONFIG };

    // Apply DB overrides
    for (const [k, v] of Object.entries(dbData)) {
      if (v) merged[k] = String(v);
    }

    // Apply env var overrides (highest priority)
    const envKeys = Object.keys(DEFAULT_MODEL_CONFIG);
    for (const key of envKeys) {
      const envVal = process.env[key];
      if (envVal) merged[key] = envVal;
    }

    this.aiModelCache = { data: merged, cachedAt: now };
    return merged;
  }

  /** Invalidate AI model config cache (call after update) */
  invalidateAiModelCache() {
    this.aiModelCache = null;
  }

  /** Update AI model config (upsert + bust cache) */
  async setAiModelConfig(patch: Record<string, string>) {
    const result = await this.patchConfig(AI_MODELS_DOC_ID, patch);
    this.aiModelCache = null;
    return result;
  }

  /** Get current AI model config (for admin inspection) */
  async getAiModelConfigRaw() {
    const doc = await this.appConfigModel.findById(AI_MODELS_DOC_ID).lean();
    return {
      dbConfig: (doc as any)?.data ?? {},
      defaults: DEFAULT_MODEL_CONFIG,
      merged: await this.getAiModelConfig(),
    };
  }
}
