export const ToolSkillCategoriesC = [''] as const;

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

  @Prop({ type: String, required: true })
  public readonly visible: boolean;

  @Prop({ type: String, required: true })
  public readonly icon: string;

  @Prop({ type: String, required: true })
  public readonly name: string;

  @Prop({ type: String, required: true })
  public readonly description: string;

  @Prop({ type: String, required: true })
  public readonly resultSchema: string;

  @Prop({ type: String, enum: ToolSkillCategoriesC, required: true })
  public readonly skillCategory: ToolSkillCategoriesT;

  @Prop({ type: Number, required: true })
  public readonly order: number;

  @Prop({ type: Array, required: true })
  public readonly tags: string[];

  @Prop({ ref: () => Accounts, type: String, required: true })
  public readonly createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public readonly properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public readonly propertiesBranches: PropertiesBranches;
}

/**
 * @interface     ToolSkillCategoriesT
 * @description   Tool Skill Categories Type
 */
export type ToolSkillCategoriesT = (typeof ToolSkillCategoriesC)[number];
