// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherExamFoldersCN = 'sst-teacher-exam-folders';

export const CollaboratorRolesC = ['editor', 'viewer'] as const;
export type CollaboratorRolesT = (typeof CollaboratorRolesC)[number];

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherExamFoldersCN } })
export class SSTTeacherExamFolders {
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

  /** Owner teacher UID */
  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  /** Exam IDs in this folder */
  @Prop({ type: [String], default: [] })
  public readonly examIds: string[];

  /** Sort order */
  @Prop({ type: Number, default: 0 })
  public readonly order: number;

  /** True if this is a system-generated folder (e.g. "Shared with me") */
  @Prop({ type: Boolean, default: false })
  public readonly appSystemFolder: boolean;

  /** True if this is a collaboration folder (shared by collab) */
  @Prop({ type: Boolean, default: false })
  public readonly collabFolder: boolean;

  /** True if this folder belongs to the requesting teacher (vs. a shared folder) */
  @Prop({ type: Boolean, default: true })
  public readonly ownFolder: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly public: boolean;

  @Prop({ type: Boolean, default: false })
  public readonly isDeleted: boolean;

  @Prop({ type: Date, default: null })
  public readonly deletedAt: Date;

  /** Collaborator UIDs who have access to this folder */
  @Prop({ type: [String], default: [] })
  public readonly collaboratorIds: string[];

  /**
   * Map of collaboratorId → display name.
   * Stored as a plain Object in MongoDB.
   */
  @Prop({ type: Object, default: {} })
  public readonly collaboratorNames: Record<string, string>;

  /**
   * Map of collaboratorId → role ('editor' | 'viewer').
   */
  @Prop({ type: Object, default: {} })
  public readonly collaboratorRoles: Record<string, CollaboratorRolesT>;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}
