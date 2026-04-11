const MiniGameDataTypesC = ['vocabulary', 'grammar', 'reading', 'listening', 'writing', 'speaking', 'custom', 'both'] as const;
const MiniGameStatusC = ['draft', 'pending_review', 'approved', 'rejected'] as const;
const MiniGameDeliveryModesC = ['single_html', 'dist_bundle'] as const;

import { SYSTEM_ID } from 'apps/common/src/utils';
import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTMiniGamesCN = 'sst-mini-games';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: SSTMiniGamesCN } })
export class SSTMiniGames {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, default: '' })
  public readonly description: string;

  @Prop({ type: String, enum: MiniGameDataTypesC, default: 'vocabulary' })
  public readonly dataType: MiniGameDataTypesT;

  @Prop({ type: String, default: '' })
  public readonly thumbnail: string;

  @Prop({ type: Number, default: 0 })
  public readonly minWords: number;

  @Prop({ type: Number, default: 0 })
  public readonly maxWords: number;

  @Prop({ type: Number, default: 0 })
  public readonly minItems: number;

  @Prop({ type: Number, default: 0 })
  public readonly maxItems: number;

  @Prop({ type: [String], default: [] })
  public readonly tags: string[];

  @Prop({ type: String, default: '' })
  public readonly createdByName: string;

  @Prop({ type: String, default: '' })
  public readonly fileName: string;

  @Prop({ type: String, default: '' })
  public readonly gameUrl: string;

  @Prop({ type: String, enum: MiniGameDeliveryModesC, default: 'single_html' })
  public readonly deliveryMode: MiniGameDeliveryModeT;

  @Prop({ type: String, default: '' })
  public readonly launchUrl: string;

  @Prop({ type: String, default: 'index.html' })
  public readonly entryPath: string;

  @Prop({ type: String, default: '' })
  public readonly storagePrefix: string;

  @Prop({ type: String, default: null })
  public readonly bundleVersion: string | null;

  @Prop({ type: Date, default: null })
  public readonly submittedAt: Date;

  @Prop({ type: String, default: '' })
  public readonly reviewNote: string;

  @Prop({ type: Date, default: null })
  public readonly reviewedAt: Date;

  @Prop({ type: Array, default: [] })
  public readonly changeLog: any[];

  @Prop({ type: Boolean, default: false })
  public readonly isActive: boolean;

  @Prop({ type: String, default: '' })
  public readonly reviewedBy: string;

  @Prop({ type: String, enum: MiniGameStatusC, default: 'draft' })
  public readonly status: MiniGameStatusT;

  @Prop({ ref: () => Accounts, type: String, default: '' })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, default: '' })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, default: '' })
  public readonly propertiesBranches: PropertiesBranches;
}

export type MiniGameDataTypesT = (typeof MiniGameDataTypesC)[number];
export type MiniGameStatusT = (typeof MiniGameStatusC)[number];
export type MiniGameDeliveryModeT = (typeof MiniGameDeliveryModesC)[number];
