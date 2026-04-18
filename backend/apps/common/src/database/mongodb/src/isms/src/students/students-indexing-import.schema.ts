import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Accounts } from '../accounts';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'students-indexing-import' } })
export class StudentsIndexingImport {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: Number, required: false })
  public currentIndex: number;

  @Prop({ type: Number, required: true })
  public totalOfCreated: number;

  @Prop({ type: Number, required: true })
  public totalOfAlreadyExist: number;

  @Prop({ type: Array, required: false })
  public records: Array<Accounts>;

  @Prop({ type: Object, required: false })
  public record?: any; // use only for indexing query response

  @Prop({ type: Number, required: false })
  public totalRecords: number; // use only for indexing query response

  /* associated to parent collection */
  @Prop({ ref: () => Accounts, type: String, required: true })
  public accounts: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;
}

export interface IStudentsIndexingImport {
  firstName: string;
  lastName: string;
  emailAddress: string;
  contactNumber: string;
  contactNumber2: string;
  // guardians: Array<IAccountsGuardian>;
  gender: string;
  birthdate: string;
  address: string;
  source: Array<string>;
  lead: boolean;
}
