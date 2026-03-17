import { Controller, HttpCode, HttpStatus, UseInterceptors, Post, UploadedFiles, Headers } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { HTTPInterceptor } from 'apps/common';
import { FileManagerService } from './file-manager.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('File Manager')
@Controller('file-manager')
export class FileManagerController {
  constructor(private readonly fileManagerService: FileManagerService) {}

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload files' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 1 }]))
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'file', format: 'binary' } },
    },
  })
  public async upload(
    @UploadedFiles() files: ParameterDecorator,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.fileManagerService.upload(files, tokenPayload);
  }
}
