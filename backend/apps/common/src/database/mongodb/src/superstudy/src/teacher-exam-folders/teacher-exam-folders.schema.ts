const CollaboratorRolesC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTeacherExamFoldersCN = 'sst-teacher-exam-folders';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTeacherExamFoldersCN } })
export class SSTTeacherExamFolders {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly color: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: Array, required: true })
  public readonly examIds: string[];

  @Prop({ type: Boolean, required: true })
  public readonly appSystemFolder: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly collabFolder: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly ownFolder: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly public: boolean;

  @Prop({ type: String, required: true })
  public readonly deletedAt: string;

  @Prop({ type: Boolean, required: true })
  public readonly deleted: boolean;

  @Prop({ type: Array, required: true })
  public readonly collaboratorNames: string[];

  @Prop({ type: Array, required: true })
  public readonly collaboratorIds: string[];

  @Prop({ type: String, enum: CollaboratorRolesC, required: true })
  public readonly collaboratorRoles: CollaboratorRolesT;

  @Prop({ type: Boolean, required: true })
  public readonly collab: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     CollaboratorRolesT
 * @description   Collaborator Roles Type
 */
export type CollaboratorRolesT = (typeof CollaboratorRolesC)[number];
