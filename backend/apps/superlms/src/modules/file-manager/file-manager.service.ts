import { HttpStatus, Injectable } from '@nestjs/common';
import { AWSS3Service, ResponseHandlerService, IAuthTokenPayload, IResponseHandlerParams, SYSTEM_ID } from 'apps/common';

@Injectable()
export class FileManagerService {
  constructor(private readonly awsS3Service: AWSS3Service) {}

  public async upload(files: ParameterDecorator, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const uploadedFiles: Array<IResponseHandlerParams> = Array<IResponseHandlerParams>();

      if (files && files['file'] && files['file'].length > 0) {
        for await (const file of files['file']) {
          const fileName = `${SYSTEM_ID()}.${file.mimetype.split('/')[1]}`;
          const pathName = `${tokenPayload.propertyId}/${tokenPayload.branchId}/${process.env.AWS_S3_UPLOADED_FILES}`;
          const uploadedFile = await this.awsS3Service.uploadFile(file.buffer, file.mimetype, pathName, fileName);
          if (uploadedFile.success) {
            uploadedFiles.push(uploadedFile);
          }
        }
      } else {
        return ResponseHandlerService({ success: false, httpCode: HttpStatus.NOT_ACCEPTABLE, message: 'Unable to upload files' });
      }
      return ResponseHandlerService({ success: true, httpCode: HttpStatus.CREATED, message: 'Successfully uploaded', data: uploadedFiles });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }
}
