import { DeleteObjectOutput } from 'aws-sdk/clients/s3';

/**
 * Data that will return to service
 * */

export interface IAWSS3UploadedResponse {
  success: boolean;
  fileName?: string;
  data?: { cdn: string } | DeleteObjectOutput;
}

/**
 * Data that will return from AWS
 * */

export interface IAWSS3ResponseData {
  ETag: string;
  Location: string;
  key: string;
  Key: string;
  Bucket: string;
  ServerSideEncryption: string;
}
// ETag: '"6054e196a1174d8fac991517cc45f96d"',
// Location: 'https://uwatcher.s3.ap-southeast-1.amazonaws.com/wyntap/uploaded/requirements-completion/12091609082581004.jpeg',
// key: 'wyntap/uploaded/requirements-completion/12091609082581004.jpeg',
// Key: 'wyntap/uploaded/requirements-completion/12091609082581004.jpeg',
// Bucket: 'uwatcher'
