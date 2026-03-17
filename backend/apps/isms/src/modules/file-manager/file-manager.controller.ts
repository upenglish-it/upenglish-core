import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IResponseHandlerParams } from 'apps/common';
import { FileManagerService } from './file-manager.service';
import { Controller, UseInterceptors, HttpCode, HttpStatus, Post, UploadedFiles, Body, Query } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('File Manager')
@Controller('file-manager')
export class FileManagerController {
  constructor(private readonly fileManagerService: FileManagerService) {}

  @Post('extract-csv')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extract CSV file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file' }]))
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'file', format: 'binary' } },
    },
  })
  public async extractCSV(@UploadedFiles() files: Array<Express.Multer.File>, @Query() query: { type: string }): Promise<IResponseHandlerParams> {
    return await this.fileManagerService.extractCSV(files, query);
  }
}
