const MiniGameDataTypesC = [''] as const;
const MiniGameStatusC = [''] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTMiniGamesCN = 'sst-mini-games';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTMiniGamesCN } })
export class SSTMiniGames {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, enum: MiniGameDataTypesC, required: true })
  public readonly dataType: MiniGameDataTypesT;

  @Prop({ type: String, required: true })
  public readonly thumbnail: string;

  @Prop({ type: Number, required: true })
  public readonly minWords: number;

  @Prop({ type: Number, required: true })
  public readonly maxWords: number;

  @Prop({ type: Array, required: true })
  public readonly tags: string[];

  @Prop({ type: String, required: true })
  public readonly createdByName: string;

  @Prop({ type: String, required: true })
  public readonly fileName: string;

  @Prop({ type: String, required: true })
  public readonly gameUrl: string;

  @Prop({ type: Date, required: true })
  public readonly submittedAt: Date;

  @Prop({ type: String, required: true })
  public readonly reviewNote: string;

  @Prop({ type: Date, required: true })
  public readonly reviewedAt: Date;

  @Prop({ type: String, required: true })
  public readonly changeLog: string;

  @Prop({ type: Boolean, required: true })
  public readonly active: boolean;

  @Prop({ type: String, required: true })
  public readonly reviewedBy: string;

  @Prop({ type: String, enum: MiniGameStatusC, required: true })
  public readonly status: MiniGameStatusT;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     MiniGameDataTypesT
 * @description   Mini Game Data Types Type
 *
 */
export type MiniGameDataTypesT = (typeof MiniGameDataTypesC)[number];

/**
 * @interface     MiniGameStatusT
 * @description   Mini Game Status Type
 *
 */
export type MiniGameStatusT = (typeof MiniGameStatusC)[number];
