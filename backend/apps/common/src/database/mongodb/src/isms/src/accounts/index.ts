import { Prop, modelOptions } from '@typegoose/typegoose';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({
  schemaOptions: {
    timestamps: true,
    versionKey: false,
    collection: 'accounts',
    toJSON: {
      getters: true,
      virtuals: true,
    },
    toObject: {
      getters: true,
      virtuals: true,
    },
  },
})
export class Accounts {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public accountId: string;

  @Prop({ type: String, required: true })
  public firstName!: string;

  @Prop({ type: String, default: '' }) // due to migration, lastName is not required
  public lastName!: string;

  @Prop({ type: Array, required: true })
  public emailAddresses: Array<string>;

  @Prop({ type: Array, required: true })
  public contactNumbers: Array<IContactNumber>;

  @Prop({ type: String, required: false })
  public gender: TAccountGender;

  @Prop({ type: String, required: false })
  public birthDate: string;

  // @Prop({ type: String, required: false })
  // public address: string;

  // @Prop({ type: String, required: false })
  // public password: string;

  @Prop({ type: String, required: false, default: null })
  public profilePhoto: string;

  @Prop({ type: Array, default: [] })
  public guardians: Array<{ name: string; relationship: string; primaryNumber: string; secondaryNumber: string }>;

  @Prop({ type: String, required: false, default: null })
  public additionalNotes: string;

  // @Prop({ type: String, required: true })
  // public baseRole: TAccountsBaseRole;

  // @Prop({ type: String, required: true })
  // public role: TAccountsRole;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  @Prop({ type: Boolean, required: false, default: true })
  public active: boolean;

  @Prop({ type: Boolean, required: false, default: false })
  public lead: boolean;

  @Prop({ type: Array, required: false, default: [] })
  public tags: Array<string>;

  @Prop({ type: Array, required: false, default: [] })
  public sources: Array<string>;

  @Prop({ type: Object, required: true })
  public notification: IAccountNotification;

  @Prop({
    type: Object,
    required: true,
    default: {
      enable: false,
      code: null,
      idleDuration: 600, // 10 mins
    },
  })
  public lockScreen: IAccountLockScreen;

  @Prop({ type: String, required: true, default: 'en' })
  public language: string;

  @Prop({ type: Object, required: false })
  public address: IAddress;

  @Prop({ type: String, required: false, default: null })
  public selectedBranch: string;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public sourceBranch: PropertiesBranches;

  @Prop({ ref: () => Array<PropertiesBranches>, type: Array, required: true })
  public propertiesBranches: Array<PropertiesBranches>;

  @Prop({ type: String, required: true })
  public role: TRole;

  @Prop({ type: String, required: true })
  public createdFrom: TCreatedFrom;

  // @Prop({ type: String, default: 'active' })
  // public status: TAccountStatus;

  @Prop({ type: Boolean, default: false })
  public enrolled: boolean; // if enrolled to any class

  @Prop({ type: Boolean, default: true })
  public official: boolean; // wether student is still a lead or officially student in the school

  @Prop({ type: Boolean, default: false })
  public won: boolean; // when marketing add the student from pipeline, it will won=true first before it becomes official

  @Prop({ type: String, required: false, default: null })
  public gcmToken: string;

  @Prop({ type: String, default: null })
  public cmnd: string;

  /* savings from off-days */
  @Prop({ type: Number, required: false, default: 0 })
  public saving: number;

  /* savings from stop-learning */
  @Prop({ type: Number, required: false, default: 0 })
  public redundantSaving: number;

  @Prop({ ref: () => Accounts, type: String, default: null })
  public assignedTo: Accounts;

  // @Prop({
  //   getters: true,
  //   setters: false,
  //   get: (a) => {
  //     console.log('a', a);
  //     return 1;
  //   },
  // })
  // public static get fullName(): string {
  //   console.log('>>', this);
  //   return 'a'; //`${this.firstName} ${this.lastName}`;
  // }
  // @Prop()
  // get fullName(): string {
  //   return `${this.firstName} ${this.lastName}`;
  // }

  // get fullName(): string {
  //   return `${this.firstName} ${this.lastName}`;
  // }
}

// export const Accounts = getModelForClass(AccountsX);

// AccountsModel.
// re-implement base Document to allow class-transformer to serialize/deserialize its properties
// This class is needed, otherwise "_id" and "__v" would be excluded from the output

// @modelOptions({
//   schemaOptions: {
//     timestamps: true,
//     versionKey: false,
//     collection: 'accounts',
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true },
//   },
// })
// export class AccountsX {
//   @prop({
//     default: () => SYSTEM_ID(),
//   })
//   public _id: string;

//   @prop({ required: true })
//   public accountId: string;

//   @prop({ required: true })
//   public firstName: string;

//   @prop({ required: true })
//   public lastName: string;

//   @prop({ required: true })
//   public emailAddresses: Array<string>;

//   @prop({ required: true })
//   public contactNumbers: Array<IContactNumber>;

//   @prop({ required: false })
//   public gender: TAccountGender;

//   @prop({ required: false })
//   public birthDate: string;

//   // @Prop({ type: String, required: false })
//   // public address: string;

//   // @Prop({ type: String, required: false })
//   // public password: string;

//   @prop({ required: false, default: null })
//   public profilePhoto: string;

//   @prop({ default: [] })
//   public guardians: Array<{ name: string; relationship: string; primaryNumber: string; secondaryNumber: string }>;

//   // @Prop({ type: String, required: true })
//   // public baseRole: TAccountsBaseRole;

//   // @Prop({ type: String, required: true })
//   // public role: TAccountsRole;

//   @prop({ required: false, default: false })
//   public deleted: boolean;

//   @prop({ required: false, default: true })
//   public active: boolean;

//   @prop({ required: false, default: false })
//   public lead: boolean;

//   @prop({ required: false, default: [] })
//   public tags: Array<string>;

//   @prop({ required: false, default: [] })
//   public sources: Array<string>;

//   @prop({ required: true })
//   public notification: IAccountNotification;

//   @prop({
//     required: true,
//     default: {
//       enable: false,
//       code: null,
//       idleDuration: 600, // 10 mins
//     },
//   })
//   public lockScreen: IAccountLockScreen;

//   @prop({ required: true, default: 'en' })
//   public language: string;

//   @prop({ required: false })
//   public address: IAddress;

//   @prop({ ref: () => Properties, required: true })
//   public properties: Properties;

//   @prop({ ref: () => PropertiesBranches, required: true })
//   public sourceBranch: PropertiesBranches;

//   @prop({ ref: () => Array<PropertiesBranches>, required: true })
//   public propertiesBranches: Array<PropertiesBranches>;

//   @prop({ required: true })
//   public role: TRole;

//   @prop({ required: true })
//   public createdFrom: TCreatedFrom;

//   // @Prop({ type: String, default: 'active' })
//   // public status: TAccountStatus;

//   @prop({ default: false })
//   public enrolled: boolean; // if enrolled to any class

//   @prop({ default: true })
//   public official: boolean; // wether student is still a lead or officially student in the school

//   @prop({ required: false, default: null })
//   public gcmToken: string;

//   @prop({ required: false, default: 0 })
//   public saving: number;

//   public get fullName(): string {
//     console.log('>>', this);
//     return `${this.firstName} ${this.lastName}`;
//   }
// }

// export const Accounts = getModelForClass(AccountsX);

export interface IContactNumber {
  countryCallingCode: string;
  number: string;
  type: string;
}

// // export interface IAccountsGuardian {
// //   name: string;
// //   relationship: string;
// //   contactNumber: string;
// //   contactNumber2?: string; // it applies only in create student
// //   guardianRelationshipId?: string; // it applies only in create student
// // }
// /**
//  * @TAccountsBaseRole
//  * @master is the owner of the product/system (CEO, Dev, Authorize person)
//  * @customer is the user who avail the product
//  */
// export type TAccountsBaseRole = 'master' | 'customer';

export type TRole = 'admin' | 'teacher' | 'student' | 'receptionist' | 'marketing';
export type TCreatedFrom = 'manual' | 'csv' | 'migration';
// export type TAccountStatus = 'active' | 'inactive';
export type TAccountGender = 'male' | 'female';

export interface IAccountNotification {
  // // software
  // softwareUpdates: boolean;

  // // gcm push notification
  // gcm: boolean;

  // // student
  // announcement: boolean;
  // tuitionPaymentInvoice: boolean;
  // challenges: boolean;

  softwareUpdates: boolean;
  payslip: boolean;
  leadConversation: boolean;
  salaryModification: boolean;
  wonLose: boolean;
  leadCreation: boolean;
  leaveApproval: boolean;
}

export interface IAccountLockScreen {
  enable: boolean;
  code: string;
  idleDuration: number;
}

export interface IAddress {
  street: string;
  city: string;
  country: string;
  state: string;
  postalCode: number;
  timezone: string;
}
