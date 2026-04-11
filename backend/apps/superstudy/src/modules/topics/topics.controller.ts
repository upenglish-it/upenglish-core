import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { TopicsService } from './topics.service';

@ApiTags('Topics (Admin)')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @ApiOperation({ summary: 'List all topics (admin)' })
  @Get()
  findAll(@Query('folderId') folderId?: string) {
    return this.topicsService.findAll(folderId);
  }

  @ApiOperation({ summary: 'List soft-deleted topics' })
  @Get('deleted')
  findDeleted() {
    return this.topicsService.findDeleted();
  }

  @ApiOperation({ summary: 'Check whether a vocab image URL is still referenced by any official topic word' })
  @Get('check-vocab-image-used')
  checkVocabImageUsed(@Query('url') url: string) {
    return this.topicsService.checkVocabImageUsed(url);
  }

  @ApiOperation({ summary: 'Upload a vocab image for topic words' })
  @Post('vocab-images/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  uploadVocabImage(@UploadedFile() file: Express.Multer.File) {
    return this.topicsService.uploadVocabImage(file);
  }

  @ApiOperation({ summary: 'Delete a vocab image previously uploaded for topic words' })
  @Delete('vocab-images')
  deleteVocabImage(@Body('url') url: string) {
    return this.topicsService.deleteVocabImage(url);
  }

  @ApiOperation({ summary: 'Get a single topic by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.topicsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create or update a topic' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.topicsService.create(body);
  }

  @ApiOperation({ summary: 'Update topic metadata' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.topicsService.update(id, body);
  }

  @ApiOperation({ summary: 'Toggle topic public status' })
  @Patch(':id/public')
  @HttpCode(HttpStatus.OK)
  togglePublic(@Param('id') id: string, @Body() body: { isPublic: boolean }) {
    return this.topicsService.update(id, { isPublic: body.isPublic });
  }

  @ApiOperation({ summary: 'Toggle teacher-visible status' })
  @Patch(':id/teacher-visible')
  @HttpCode(HttpStatus.OK)
  toggleTeacherVisible(
    @Param('id') id: string,
    @Body() body: { teacherVisible: boolean },
  ) {
    return this.topicsService.update(id, { teacherVisible: body.teacherVisible });
  }

  @ApiOperation({ summary: 'Soft-delete a topic' })
  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.topicsService.softDelete(id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted topic' })
  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.topicsService.restore(id);
  }

  @ApiOperation({ summary: 'Permanently delete a topic' })
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.topicsService.permanentDelete(id);
  }
}
