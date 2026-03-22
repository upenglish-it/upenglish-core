export const TopicStatusC = ['draft', 'published', 'archived'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTTopicsCN = 'sst-topics';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTTopicsCN } })
export class SSTTopics {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: String, required: true })
  public readonly color: string;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, enum: TopicStatusC, required: true })
  public readonly status: TopicStatusT;

  @Prop({ type: Number, required: true })
  public readonly cachedWordCount: number;

  @Prop({ type: Boolean, required: true })
  public readonly inPublicFolder: boolean;

  @Prop({ type: Boolean, required: true })
  public readonly public: boolean;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     TopicStatusT
 * @description   Topic Status Type
 */
export type TopicStatusT = (typeof TopicStatusC)[number];
