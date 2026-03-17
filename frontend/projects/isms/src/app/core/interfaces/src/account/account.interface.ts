// import { IContactNumber } from "./account-contact.interface";

export interface IAccount {
  _id: string;
  accountId: string;
  cmnd: string;
  firstName: string;
  lastName: string;
  gender: TAccountGender;
  birthDate: string;
  propertiesBranches: Array<string>;
  address: IAddress;
  tags: Array<string | any>;
  sources: Array<string>;

  emailAddresses: Array<string>;
  contactNumbers: Array<IContactNumber>;
  guardians: Array<IGuardian>;
  additionalNotes: string;
  createdAt: string;
  updatedAt: string;

  active: boolean;
  classes: Array<IAccountClass>;
  role: TRole;
  enrolled: boolean;
  official: boolean;
  createdFrom: TCreatedFrom;
  assignedTo: string | null;
  saving: number;
  redundantSaving: number;
  won: boolean;

  profilePhoto: string;
  gcmToken: string;
  // organization: IOrganization;
  notification: {
    softwareUpdates: boolean;
    gcm: boolean;
    payslip: boolean;
    leadConversation: boolean;
    salaryModification: boolean;
    wonLose: boolean;
    leadCreation: boolean;
    leaveApproval: boolean;
  };
  lockScreen: {
    enable: boolean;
    code: string;
    idleDuration: number;
  };

  selectedBranch: string;

  selected?: boolean; // added in FE
  hide?: boolean; // added in FE (use to hide/show in listing)

  // Added in FE. Used in pipeline
  notes?: number;
  conversations?: number;
  activityLogs?: number;

  attendance?: AttendanceI[];
}

export interface AttendanceI {
  enabled?: boolean;
  /** Backend uses "enable" */
  enable?: boolean;
  included: boolean;
  year: number;
  month: number;
}

export interface IGuardian {
  name: string;
  relationship: string;
  primaryNumber: string;
  secondaryNumber: string;
}

export interface IContactNumber {
  countryCallingCode: string;
  number: string;
  type: {
    name: string;
    value: string;
  };
}

// export interface IOrganization {
//   _id: string;
//   logo: string;
//   coverPhoto: string;
//   name: string;
//   description: string;
//   emailAddress: string;
//   contactNumber: string;
//   address: string;
//   website: string;
//   country: string;
//   totalEmployee: number;
//   createdAt: string;
//   updatedAt: string;
// }

export interface IAddress {
  street: string;
  city: string;
  country: string;
  state: string;
  postalCode: number;
  timezone: string;
}

export interface IAccountClass {
  classId: string;
  inDebt: boolean;
}

export type TRole = "admin" | "teacher" | "student" | "receptionist" | "marketing";
export type TCreatedFrom = "manual" | "csv";
export type TAccountGender = "male" | "female";
