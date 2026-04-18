// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTExamFoldersCN = 'sst-exam-folders';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTExamFoldersCN } })
export class SSTExamFolders {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, default: '' })
  public readonly description: string;

  @Prop({ type: String, default: '📝' })
  public readonly icon: string;

  @Prop({ type: String, default: '#3b82f6' })
  public readonly color: string;

  /** Exam IDs inside this folder */
  @Prop({ type: [String], default: [] })
  public readonly examIds: string[];

  /** If this folder was duplicated, source folder ID */
  @Prop({ type: String, default: null })
  public readonly copiedFrom: string;

  /** UID of the teacher who proposed this folder */
  @Prop({ type: String, default: null })
  public readonly proposedBy: string;

  /** Display name of the proposing teacher */
  @Prop({ type: String, default: null })
  public readonly proposedByName: string;

  /** When true all teachers can see this folder */
  @Prop({ type: Boolean, default: false })
  public readonly teacherVisible: boolean;

  /** Teacher UIDs that have been explicitly shared this folder */
  @Prop({ type: [String], default: [] })
  public readonly sharedWithTeacherIds: string[];

  @Prop({ type: Boolean, default: false })
  public readonly isPublic: boolean;

  /** Sort order */
  @Prop({ type: Number, default: 0 })
  public readonly order: number;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
