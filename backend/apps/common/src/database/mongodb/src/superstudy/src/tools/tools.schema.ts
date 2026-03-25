export const ToolSkillCategoriesC = ['speaking', 'writing', 'reading', 'listening', 'grammar', 'vocabulary'] as const;

// Utils
import { SYSTEM_ID } from 'apps/common/src/utils';
// NestJs Imports
import { Prop, modelOptions } from '@typegoose/typegoose';
// Schemas
import { Accounts, Properties, PropertiesBranches } from '../../../isms';

export const SSTToolsCN = 'sst-tools';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: SSTToolsCN } })
export class SSTTools {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: Boolean, default: true })
  public readonly visible: boolean;

  @Prop({ type: String, default: null })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, default: null })
  public readonly description: string;

  /** JSON schema string defining the expected result structure */
  @Prop({ type: String, default: null })
  public readonly resultSchema: string;

  @Prop({ type: String, enum: ToolSkillCategoriesC, default: null })
  public readonly skillCategory: ToolSkillCategoriesT;

  @Prop({ type: Number, default: 0 })
  public readonly order: number;

  @Prop({ type: Array, default: [] })
  public readonly tags: string[];

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

export type ToolSkillCategoriesT = (typeof ToolSkillCategoriesC)[number];
