import { HttpStatus, Injectable } from '@nestjs/common';
import { IResponseHandlerParams, ResponseHandlerService } from 'apps/common';
import * as xlsx from 'xlsx';
import * as iconv from 'iconv-lite';

@Injectable()
export class FileManagerService {
  public async extractCSV(files: Array<Express.Multer.File>, query: { type: string }): Promise<IResponseHandlerParams> {
    try {
      let header: Array<string> = [];
      let records = [];

      if (files && files['file'] && files['file'].length > 0) {
        // const workbook = xlsx.read(files['file'][0].buffer, { codepage: 65001, type: 'buffer' });

        const decodedContent = iconv.decode(files['file'][0].buffer, query.type); // Replace 'utf-8' | 'macintosh' with the correct encoding if needed
        console.log('decodedContent', decodedContent);
        const workbook = xlsx.read(decodedContent, { type: 'string' });

        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        const sheetHeader = { blankrows: true };
        const extractedRecords = xlsx.utils.sheet_to_json(worksheet, { ...sheetHeader, header: 1, raw: false });
        header = extractedRecords.shift() as Array<string>; // get first index
        records = extractedRecords;
        if (records.length > 1000) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.NOT_ACCEPTABLE,
            message: 'The number of records in the file has exceeded the maximum limit of 1000. Please reduce the number of records and try again',
          });
        }
      } else {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_ACCEPTABLE,
          message: 'Unable to upload file',
        });
      }
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        data: { header, records },
      });
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
