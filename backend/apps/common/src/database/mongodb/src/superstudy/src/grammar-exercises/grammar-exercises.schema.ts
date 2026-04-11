export const GrammarExerciseTargetLevelsC = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTGrammarExercisesCN = 'sst-grammar-exercises';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTGrammarExercisesCN } })
export class SSTGrammarExercises {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly title: string;

  @Prop({ type: String, default: null })
  public readonly description: string;

  @Prop({ type: String, default: null })
  public readonly icon: string;

  @Prop({ type: String, default: null })
  public readonly color?: string;

  /** 'admin' | 'teacher' */
  @Prop({ type: String, default: null })
  public readonly createdByRole: string;

  @Prop({ type: String, default: null })
  public readonly copiedFrom: string;

  @Prop({ type: String, default: null })
  public readonly proposedBy: string;

  @Prop({ type: [String], default: [] })
  public readonly proposedByName: string[];

  @Prop({ type: String, default: null })
  public readonly name: string;

  @Prop({ type: String, enum: GrammarExerciseTargetLevelsC, default: null })
  public readonly targetLevel?: GrammarExerciseTargetLevelsT;

  @Prop({ type: String, default: null })
  public readonly targetAge: string;

  @Prop({ type: String, default: null })
  public readonly teacherId: string;

  @Prop({ type: Number, default: 0 })
  public readonly cachedQuestionCount: number;

  @Prop({ type: Boolean, default: false })
  public readonly owner: boolean;

  @Prop({ type: String, default: null })
  public readonly duplicatedFrom: string;

  @Prop({ type: [String], default: [] })
  public readonly collaborators: string[];

  @Prop({ type: [String], default: [] })
  public readonly collaboratorNames: string[];

  @Prop({ type: [String], default: [] })
  public readonly collaboratorIds: string[];

  @Prop({ type: Boolean, default: false })
  public readonly admin: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ type: Boolean, default: false })
  public readonly archived: boolean;

  @Prop({ type: String, default: null })
  public readonly convertedFrom: string;

  @Prop({ type: Boolean, default: false })
  public readonly isPublic: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly teacherVisible: boolean;

  @Prop({ type: Date, default: null })
  public readonly transferredAt: Date;

  @Prop({ type: String, default: null })
  public readonly transferredToName: string;

  /** Folder this exercise belongs to */
  @Prop({ type: String, default: null })
  public readonly folderId: string;

  /** Teacher IDs individually shared this exercise */
  @Prop({ type: [String], default: [] })
  public readonly sharedWithTeacherIds: string[];

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;
}

export type GrammarExerciseTargetLevelsT = (typeof GrammarExerciseTargetLevelsC)[number];
