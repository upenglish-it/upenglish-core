import {
  Controller, Get, Post, Delete, Patch,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherFoldersService } from './teacher-folders.service';

@ApiTags('Teacher Folders')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('teacher-folders')
export class TeacherFoldersController {
  constructor(private readonly service: TeacherFoldersService) {}

  // ─── Teacher Topic Folders ───────────────────────────────────────────────

  @ApiOperation({ summary: 'Get topic folders for a teacher (sorted by order, excludes deleted)' })
  @Get('topics')
  getTeacherTopicFolders(@Query('teacherId') teacherId: string) {
    return this.service.getTeacherFolders('topics', teacherId);
  }

  @ApiOperation({ summary: 'Get ALL teacher topic folders across all teachers (admin use)' })
  @Get('topics/all')
  getAllTeacherTopicFolders() {
    return this.service.getAllTeacherFolders('topics');
  }

  @ApiOperation({ summary: 'Get soft-deleted topic folders for a teacher' })
  @Get('topics/deleted')
  getDeletedTeacherTopicFolders(@Query('teacherId') teacherId: string) {
    return this.service.getDeletedTeacherFolders('topics', teacherId);
  }

  @ApiOperation({ summary: 'Create or update a teacher topic folder' })
  @Post('topics')
  @HttpCode(HttpStatus.OK)
  saveTeacherTopicFolder(@Body() body: Record<string, any>) {
    return this.service.saveTeacherFolder('topics', body);
  }

  @ApiOperation({ summary: 'Reorder teacher topic folders (drag-and-drop)' })
  @Patch('topics/reorder')
  @HttpCode(HttpStatus.OK)
  reorderTeacherTopicFolders(@Body() body: { folders: Array<{ id: string; order: number }> }) {
    return this.service.reorderTeacherFolders('topics', body.folders);
  }

  @ApiOperation({ summary: 'Soft-delete a teacher topic folder (isDeleted = true)' })
  @Delete('topics/:id')
  softDeleteTeacherTopicFolder(@Param('id') id: string) {
    return this.service.softDeleteTeacherFolder('topics', id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted teacher topic folder' })
  @Post('topics/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreTeacherTopicFolder(@Param('id') id: string) {
    return this.service.restoreTeacherFolder('topics', id);
  }

  @ApiOperation({ summary: 'Permanently delete a teacher topic folder' })
  @Delete('topics/:id/permanent')
  permanentDeleteTeacherTopicFolder(@Param('id') id: string) {
    return this.service.permanentDeleteTeacherFolder('topics', id);
  }

  // ─── Teacher Grammar Folders ─────────────────────────────────────────────

  @ApiOperation({ summary: 'Get grammar folders for a teacher' })
  @Get('grammar')
  getTeacherGrammarFolders(@Query('teacherId') teacherId: string) {
    return this.service.getTeacherFolders('grammar', teacherId);
  }

  @ApiOperation({ summary: 'Get ALL teacher grammar folders (admin use)' })
  @Get('grammar/all')
  getAllTeacherGrammarFolders() {
    return this.service.getAllTeacherFolders('grammar');
  }

  @ApiOperation({ summary: 'Get soft-deleted grammar folders for a teacher' })
  @Get('grammar/deleted')
  getDeletedTeacherGrammarFolders(@Query('teacherId') teacherId: string) {
    return this.service.getDeletedTeacherFolders('grammar', teacherId);
  }

  @ApiOperation({ summary: 'Create or update a teacher grammar folder' })
  @Post('grammar')
  @HttpCode(HttpStatus.OK)
  saveTeacherGrammarFolder(@Body() body: Record<string, any>) {
    return this.service.saveTeacherFolder('grammar', body);
  }

  @ApiOperation({ summary: 'Reorder teacher grammar folders' })
  @Patch('grammar/reorder')
  @HttpCode(HttpStatus.OK)
  reorderTeacherGrammarFolders(@Body() body: { folders: Array<{ id: string; order: number }> }) {
    return this.service.reorderTeacherFolders('grammar', body.folders);
  }

  @ApiOperation({ summary: 'Soft-delete a teacher grammar folder' })
  @Delete('grammar/:id')
  softDeleteTeacherGrammarFolder(@Param('id') id: string) {
    return this.service.softDeleteTeacherFolder('grammar', id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted teacher grammar folder' })
  @Post('grammar/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreTeacherGrammarFolder(@Param('id') id: string) {
    return this.service.restoreTeacherFolder('grammar', id);
  }

  @ApiOperation({ summary: 'Permanently delete a teacher grammar folder' })
  @Delete('grammar/:id/permanent')
  permanentDeleteTeacherGrammarFolder(@Param('id') id: string) {
    return this.service.permanentDeleteTeacherFolder('grammar', id);
  }

  // ─── Teacher Exam Folders ────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get exam folders for a teacher' })
  @Get('exams')
  getTeacherExamFolders(@Query('teacherId') teacherId: string) {
    return this.service.getTeacherFolders('exams', teacherId);
  }

  @ApiOperation({ summary: 'Get ALL teacher exam folders (admin use)' })
  @Get('exams/all')
  getAllTeacherExamFolders() {
    return this.service.getAllTeacherFolders('exams');
  }

  @ApiOperation({ summary: 'Get soft-deleted exam folders for a teacher' })
  @Get('exams/deleted')
  getDeletedTeacherExamFolders(@Query('teacherId') teacherId: string) {
    return this.service.getDeletedTeacherFolders('exams', teacherId);
  }

  @ApiOperation({ summary: 'Create or update a teacher exam folder' })
  @Post('exams')
  @HttpCode(HttpStatus.OK)
  saveTeacherExamFolder(@Body() body: Record<string, any>) {
    return this.service.saveTeacherFolder('exams', body);
  }

  @ApiOperation({ summary: 'Reorder teacher exam folders' })
  @Patch('exams/reorder')
  @HttpCode(HttpStatus.OK)
  reorderTeacherExamFolders(@Body() body: { folders: Array<{ id: string; order: number }> }) {
    return this.service.reorderTeacherFolders('exams', body.folders);
  }

  @ApiOperation({ summary: 'Soft-delete a teacher exam folder' })
  @Delete('exams/:id')
  softDeleteTeacherExamFolder(@Param('id') id: string) {
    return this.service.softDeleteTeacherFolder('exams', id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted teacher exam folder' })
  @Post('exams/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreTeacherExamFolder(@Param('id') id: string) {
    return this.service.restoreTeacherFolder('exams', id);
  }

  @ApiOperation({ summary: 'Permanently delete a teacher exam folder' })
  @Delete('exams/:id/permanent')
  permanentDeleteTeacherExamFolder(@Param('id') id: string) {
    return this.service.permanentDeleteTeacherFolder('exams', id);
  }
}
