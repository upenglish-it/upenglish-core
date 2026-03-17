import * as bcryptjs from 'bcryptjs';
import { TContactType, TVerificationPurpose } from '../../types';
import { BCRYPT_ROUND } from '../../constants';
import { IAuthToken } from '../../interfaces';
import { NodeRSAEncryptService } from '../../services';
import { ulid } from 'ulidx';

/**
 * @count eg: 6 = 9N3EKD
 * */
export const CODE_GENERATOR = (count: number): string => {
  const length = count;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
  return result;
};

export const RANDOM_NUMBER_GENERATOR = (count: number): string => {
  const length = count;
  const chars = '0123456789';
  let result = '';
  for (let i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
  return result;
};

/**
 * Encrypt password
 * @password is the inputed password
 * */
export const PASSWORD_HASHER = async (password: string): Promise<string> => {
  const hashedPassword = await bcryptjs.hash(password, BCRYPT_ROUND);
  return hashedPassword;
};

/**
 * Compare password if matched
 * */
export const PASSWORD_MATCHED = async (password: string, comparePassword: string): Promise<boolean> => {
  return await bcryptjs.compare(password, comparePassword);
};

/**
 * Compose device session token data
 * */
export const DEVICE_SESSION_TOKEN_DATA = (data: IAuthToken): IAuthToken => {
  return data;
};

/**
 * Compose token data for verification
 * */
export const VERIFICATION_TOKEN_DATA = (data: IVerificationTokenData): IVerificationTokenData => {
  return data;
};

export interface IVerificationTokenData {
  code: string;
  type: TContactType;
  purpose: TVerificationPurpose;
  accountId: string;
  value: string;
  fullName: string;
}

export const VERIFICATION_TOKEN_IS_VALID = (data: IVerificationTokenData, compareData: IVerificationTokenData): boolean => {
  if (data.accountId === compareData.accountId && data.code === compareData.code && data.type === compareData.type) {
    return true;
  }
  return false;
};

export const GENERATE_AUTHORIZATION_TOKEN = (data: IAuthToken): string => {
  console.log('data', data);
  return NodeRSAEncryptService(data);
};

export const SYSTEM_ID = () => {
  return `${process.env.PROJECT_PREFIX}${ulid()}`;
};

// export interface IAuthorizationToken {
//   expiration: string; // date expired
//   requestHeaders: Headers; // use for identifying if the device used in not a bot
//   data: IAuthorizationTokenData; // any data sensitive information
// }
// export interface IAuthorizationTokenData {
//   accountId: string;
//   propertyId?: string; // seller business id
//   branchId?: string; // seller shop id
// }
