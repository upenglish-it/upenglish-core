import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'students-smart-filter' } })
export class StudentsSmartFilter {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public title: string;

  @Prop({ type: Array, required: true, default: [] })
  public filters: Array<IFilter>;

  /* associated to parent collection */
  @Prop({ ref: () => Accounts, type: String, required: true })
  public accounts: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;
}

export type TParameters = 'student/gender' | 'student/age' | 'student/status' | 'student/country' | 'student/branch' | 'student/lead';
export type TOperators = 'is' | 'is-not' | 'is-in' | 'is-not-in' | 'equal' | 'not-equal' | 'less-than-and-equal' | 'greater-than-and-equal';

export interface IFilter {
  parameter: IGenericNameValue;
  operator: IGenericNameValue;
  value: IGenericNameValue;
  sequenceOperator: IGenericNameValue;
}

export interface IGenericNameValue {
  name: string;
  value: any;
}
