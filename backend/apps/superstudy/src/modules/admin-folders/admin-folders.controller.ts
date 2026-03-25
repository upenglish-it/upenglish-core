import {
  Controller, Get, Post, Delete, Patch,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminFoldersService } from './admin-folders.service';

type FolderType = 'topics' | 'grammar' | 'exams';

@ApiTags('Admin Folders')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('admin-folders')
export class AdminFoldersController {
  constructor(private readonly service: AdminFoldersService) {}

  // ─── Topic Folders ──────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get all admin topic folders (sorted by order)' })
  @Get('topics')
  getTopicFolders() {
    return this.service.getFolders('topics');
  }

  @ApiOperation({ summary: 'Create or update an admin topic folder' })
  @Post('topics')
  @HttpCode(HttpStatus.OK)
  saveTopicFolder(@Body() body: Record<string, any>) {
    return this.service.saveFolder('topics', body);
  }

  @ApiOperation({ summary: 'Delete an admin topic folder' })
  @Delete('topics/:id')
  deleteTopicFolder(@Param('id') id: string) {
    return this.service.deleteFolder('topics', id);
  }

  @ApiOperation({ summary: 'Reorder admin topic folders (drag-and-drop)' })
  @Patch('topics/reorder')
  @HttpCode(HttpStatus.OK)
  reorderTopicFolders(@Body() body: { folders: Array<{ id: string; order: number }> }) {
    return this.service.reorderFolders('topics', body.folders);
  }

  // ─── Grammar Folders ────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get all admin grammar folders (sorted by order)' })
  @Get('grammar')
  getGrammarFolders() {
    return this.service.getFolders('grammar');
  }

  @ApiOperation({ summary: 'Create or update an admin grammar folder' })
  @Post('grammar')
  @HttpCode(HttpStatus.OK)
  saveGrammarFolder(@Body() body: Record<string, any>) {
    return this.service.saveFolder('grammar', body);
  }

  @ApiOperation({ summary: 'Delete an admin grammar folder' })
  @Delete('grammar/:id')
  deleteGrammarFolder(@Param('id') id: string) {
    return this.service.deleteFolder('grammar', id);
  }

  @ApiOperation({ summary: 'Reorder admin grammar folders' })
  @Patch('grammar/reorder')
  @HttpCode(HttpStatus.OK)
  reorderGrammarFolders(@Body() body: { folders: Array<{ id: string; order: number }> }) {
    return this.service.reorderFolders('grammar', body.folders);
  }

  // ─── Exam Folders ───────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get all admin exam folders (sorted by order)' })
  @Get('exams')
  getExamFolders() {
    return this.service.getFolders('exams');
  }

  @ApiOperation({ summary: 'Create or update an admin exam folder' })
  @Post('exams')
  @HttpCode(HttpStatus.OK)
  saveExamFolder(@Body() body: Record<string, any>) {
    return this.service.saveFolder('exams', body);
  }

  @ApiOperation({ summary: 'Delete an admin exam folder' })
  @Delete('exams/:id')
  deleteExamFolder(@Param('id') id: string) {
    return this.service.deleteFolder('exams', id);
  }

  @ApiOperation({ summary: 'Reorder admin exam folders' })
  @Patch('exams/reorder')
  @HttpCode(HttpStatus.OK)
  reorderExamFolders(@Body() body: { folders: Array<{ id: string; order: number }> }) {
    return this.service.reorderFolders('exams', body.folders);
  }
}
