/**
 * Account Data Types
 *
 * @file          account.endpoints.datatypes
 * @description   Defines all endpoint data types associated with /api/account/*
 * @author        John Mark Alicante
 * @since         2024 - 08 - 19
 */

/***********************************************
 * @interface     AccountI
 * @description   Account detail interface
 */
export interface AccountI {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string;
  createdAt: string;
  updatedAt: string;
  deleted: string;
  organization: OrganizationI;
  contacts: Array<AccountContactI>;
  contact: AccountContactI;
}

/***********************************************
 * @interface     OrganizationI
 * @description   Organization detail interface
 */
export interface OrganizationI {
  id: string;
  logo: string;
  coverPhoto: string;
  name: string;
  description: string;
  emailAddress: string;
  contactNumber: string;
  address: string;
  website: string;
  country: string;
  totalEmployee: number;
  createdAt: string;
  updatedAt: string;
}

/***********************************************
 * @interface     AccountContactI
 * @description   Account contact detail interface
 */
export interface AccountContactI {
  id: string;
  ordinal: OrdinalT;
  type: AccountContactTypeT;
  status: ContactStatusT;
  value: string;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
}
export type AccountContactTypeT = "email" | "number";
export type OrdinalT = "primary" | "secondary";
export type ContactStatusT = "verified" | "unverified";
