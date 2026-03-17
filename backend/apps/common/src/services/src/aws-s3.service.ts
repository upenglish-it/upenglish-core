// import { Injectable } from '@nestjs/common';
// import * as AWS from 'aws-sdk';
// import { DeleteObjectOutput } from 'aws-sdk/clients/s3';
// import { IAWSS3ResponseData, IAWSS3UploadedResponse } from '../../interfaces';

// @Injectable()
// export class AWSS3Service {
//   private s3: AWS.S3;

//   constructor() {
//     AWS.config.update({
//       accessKeyId: '',
//       secretAccessKey: '',
//       region: 'ap-southeast-1',
//     });
//     this.s3 = new AWS.S3();
//   }

//   /**
//    * Delete file
//    * **/
//   public deleteFile(fileName: string): Promise<IAWSS3UploadedResponse> {
//     return new Promise((resolve, reject) => {
//       this.s3.deleteObject(
//         {
//           Bucket: `${process.env.AWS_S3_ORIGIN_BUCKET}/uploaded/menu-category-item`,
//           Key: fileName,
//         },
//         (err, data: DeleteObjectOutput) => {
//           if (err) {
//             return reject({ success: false });
//           }
//           return resolve({ success: true, data });
//         },
//       );
//     });
//   }

//   /**
//    * Upload file
//    * **/
//   public uploadFile(file: any, bucketFolder: string): Promise<IAWSS3UploadedResponse> {
//     return new Promise((resolve, reject) => {
//       const fileName = `${()}.${file.mimetype.split('/')[1]}`;

//       const params: AWS.S3.Types.PutObjectRequest = {
//         Bucket: `${process.env.AWS_S3_ORIGIN_BUCKET}/${bucketFolder}`,
//         Key: fileName,
//         ACL: 'public-read',
//         Body: file.buffer,
//       };

//       this.s3.upload(params, function (err: object, data: IAWSS3ResponseData) {
//         if (err) {
//           return reject({ success: false });
//         }
//         return resolve({ success: true, fileName, data });
//       });
//     });
//   }

//   /**
//    * @pathName eg: orgId/leading/*
//    * @fileName eg: 7b7eef63-d694-4b7e-b071-cd03ef3b3c48.mp3
//    * **/
//   public uploadBufferFile(buffer: Buffer, pathName: string, fileName: string): Promise<IAWSS3UploadedResponse> {
//     return new Promise((resolve, reject) => {
//       const params: AWS.S3.Types.PutObjectRequest = {
//         Bucket: `${process.env.AWS_S3_BUCKET}/${pathName}`,
//         Key: fileName,
//         ACL: 'public-read',
//         Body: buffer,
//       };

//       this.s3.upload(params, function (err: any, data: IAWSS3ResponseData) {
//         if (err) {
//           return reject({ success: false });
//         }
//         return resolve({ success: true, fileName, data });
//       });
//     });
//   }
// }

import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { IAWSS3ResponseData, IAWSS3UploadedResponse } from '../../interfaces';

@Injectable()
export class AWSS3Service {
  private s3: AWS.S3;

  constructor() {
    AWS.config.update({
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
      region: 'ap-southeast-1',
    });
    this.s3 = new AWS.S3();
  }

  public uploadFile(buffer: any, contentType: string, pathName: string, fileName: string): Promise<IAWSS3UploadedResponse> {
    return new Promise((resolve, reject) => {
      const params: AWS.S3.Types.PutObjectRequest = {
        Bucket: `${process.env.AWS_S3_BUCKET}/${pathName}`,
        Key: fileName,
        ACL: 'public-read',
        Body: buffer,
        ...(contentType ? { ContentType: contentType } : null),
      };
      this.s3.upload(params, function (err: any, data: IAWSS3ResponseData) {
        if (err) {
          return reject({ success: false, error: err });
        }
        return resolve({
          success: true,
          fileName,
          data: {
            cdn: `${process.env.AWS_CDN_PATH}/${data.Key}`,
          },
        });
      });
    });
  }

  public uploadBase64File(buffer: any, contentType: string, pathName: string, fileName: string): Promise<IAWSS3UploadedResponse> {
    return new Promise((resolve, reject) => {
      const params: AWS.S3.Types.PutObjectRequest = {
        Bucket: `${process.env.AWS_S3_BUCKET}/${pathName}`,
        Key: fileName,
        ACL: 'public-read',
        Body: buffer,
        ContentEncoding: 'base64',
        ContentType: contentType,
      };
      this.s3.upload(params, function (err: any, data: IAWSS3ResponseData) {
        if (err) {
          return reject({ success: false });
        }
        return resolve({
          success: true,
          fileName,
          data: {
            cdn: `${process.env.AWS_CDN_PATH}/${data.Key}`,
          },
        });
      });
    });
  }
}
