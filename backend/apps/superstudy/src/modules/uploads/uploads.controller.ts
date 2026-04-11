import { Body, Controller, Delete, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @ApiOperation({ summary: 'Upload a public asset to the configured uploaded-files bucket path' })
  @Post('public')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string' },
      },
      required: ['file', 'folder'],
    },
  })
  uploadPublic(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder: string,
  ) {
    return this.uploadsService.uploadPublic(file, folder);
  }

  @ApiOperation({ summary: 'Delete a previously uploaded public asset by URL' })
  @Delete('public')
  deletePublic(@Body('url') url: string) {
    return this.uploadsService.deletePublic(url);
  }
}
