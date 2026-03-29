const ContentProposalsC = ['vocab', 'grammar', 'exam'] as const;
const LevelsC = ['item', 'folder'] as const;
const StatusC = ['pending', 'approved', 'rejected'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTContentProposalsCN = 'sst-content-proposals';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTContentProposalsCN } })
export class SSTContentProposals {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, enum: ContentProposalsC, required: true })
  public readonly type: ContentProposalsT;

  @Prop({ type: String, enum: LevelsC, required: true })
  public readonly level: LevelsT;

  @Prop({ type: String, required: true })
  public readonly sourceId: string;

  @Prop({ type: String, required: false })
  public readonly sourceFolderId?: string;

  @Prop({ type: String, required: false })
  public readonly sourceCollection?: string;

  @Prop({ type: String, required: true })
  public readonly teacherId: string;

  @Prop({ type: String, required: true })
  public readonly teacherName: string;

  @Prop({ type: String, required: false })
  public readonly teacherEmail?: string;

  @Prop({ type: String, required: true })
  public readonly proposalName: string;

  @Prop({ type: String, required: false })
  public readonly proposalDescription?: string;

  @Prop({ type: String, required: false })
  public readonly icon?: string;

  @Prop({ type: String, required: false })
  public readonly color?: string;

  @Prop({ type: String, required: false })
  public readonly adminNote?: string;

  @Prop({ type: String, required: false })
  public readonly approveMode?: string;

  @Prop({ type: Date, required: false })
  public readonly reviewedAt?: Date;

  @Prop({ type: String, required: false })
  public readonly reviewedBy?: string;

  @Prop({ type: String, enum: StatusC, required: true, default: 'pending' })
  public readonly status: StatusT;

  @Prop({ ref: () => Accounts, type: String, required: false })
  public readonly createdBy?: Accounts;

  @Prop({ ref: () => Properties, type: String, required: false })
  public readonly properties?: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: false })
  public readonly propertiesBranches?: PropertiesBranches;

  @Prop({ type: Boolean, default: false })
  public readonly deleted: boolean;
}

/**
 * @interface     ContentProposalsT
 * @description   Content Proposals Type
 */
export type ContentProposalsT = (typeof ContentProposalsC)[number];

/**
 * @interface     LevelsT
 * @description   Levels Type
 */
export type LevelsT = (typeof LevelsC)[number];

/**
 * @interface     StatusT
 * @description   Status Type
 */
export type StatusT = (typeof StatusC)[number];
