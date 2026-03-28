// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';

export const SSTAppConfigCN = 'sst-app-config';

/**
 * Runtime application configuration document.
 * MongoDB equivalent of Firestore `app_config/{docId}` collection.
 *
 * The primary document is `docId = "ai_models"` which stores the AI model routing config.
 * This mirrors the original aiProxy.js Firestore config without any Firebase dependency.
 *
 * AI Model Config fields (all optional — env vars are the fallback):
 *   FREE_MODEL_PRIMARY, FREE_MODEL_BACKUP, FREE_MEDIA_ENABLED
 *   STANDARD_MODEL_PRIMARY, STANDARD_MODEL_BACKUP
 *   STANDARD_MEDIA_VISION, STANDARD_MEDIA_AUDIO, STANDARD_MEDIA_IMAGE, STANDARD_MEDIA_LISTENING
 *   PREMIUM_MODEL_PRIMARY, PREMIUM_MODEL_BACKUP
 *   PREMIUM_MEDIA_VISION, PREMIUM_MEDIA_AUDIO, PREMIUM_MEDIA_IMAGE, PREMIUM_MEDIA_LISTENING
 */
@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTAppConfigCN } })
export class SSTAppConfig {
  /** Document ID — e.g. "ai_models", "app_settings" */
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  /**
   * Flexible data bag — stores config key/value pairs.
   * For ai_models doc, keys are: FREE_MODEL_PRIMARY, STANDARD_MODEL_PRIMARY, etc.
   * Mirrors Firestore doc data() object exactly.
   */
  @Prop({ type: Object, default: {} })
  public readonly data: Record<string, any>;

  /** Human-readable description of what this config document stores */
  @Prop({ type: String, default: '' })
  public readonly description: string;
}
