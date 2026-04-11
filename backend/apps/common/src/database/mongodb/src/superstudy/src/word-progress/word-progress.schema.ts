// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTWordProgressCN = 'sst-word-progress';

/**
 * Tracks a student's learning progress for a specific word within a topic.
 * Migrated from the Firestore sub-collection: users/{uid}/word_progress/{wordId}
 *
 * Each document = one word for one user in one topic.
 */
@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTWordProgressCN } })
export class SSTWordProgress {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  // The student who owns this progress record
  @Prop({ type: String, required: true, index: true })
  public readonly userId: string;

  // The topic this word belongs to
  @Prop({ type: String, required: true, index: true })
  public readonly topicId: string;

  // Optional: whether the topic is an admin topic or a teacher topic
  @Prop({ type: String, default: null })
  public readonly topicType: string; // 'admin' | 'teacher'

  // The unique word identifier (word string or word ID)
  @Prop({ type: String, required: true })
  public readonly wordId: string;

  // The English word itself (for display / search)
  @Prop({ type: String, default: null })
  public readonly word: string;

  // === Vocabulary learning progress (per step/game) ===

  // How many times the student has practiced this word
  @Prop({ type: Number, default: 0 })
  public readonly practiceCount: number;

  // Mastery score 0-100 (computed from game performance)
  @Prop({ type: Number, default: 0 })
  public readonly masteryScore: number;

  // Whether the word is considered "mastered" (masteryScore >= threshold)
  @Prop({ type: Boolean, default: false })
  public readonly isMastered: boolean;

  // Last time the student successfully recalled this word
  @Prop({ type: Date, default: null })
  public readonly lastPracticedAt: Date;

  // Game-level scores (each key is a game type e.g. "meaning", "spelling", "listening")
  @Prop({ type: Object, default: {} })
  public readonly gameScores: Record<string, number>;

  // Number of consecutive correct answers (used for spaced repetition / streak logic)
  @Prop({ type: Number, default: 0 })
  public readonly correctStreak: number;

  // Pronunciation evaluation score (0-100) from AI
  @Prop({ type: Number, default: null })
  public readonly pronunciationScore: number;

  // Next review time (for spaced repetition scheduling)
  @Prop({ type: Date, default: null })
  public readonly nextReviewAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
