import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherTopicsService } from './teacher-topics.service';

@ApiTags('Teacher Topics')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('teacher-topics')
export class TeacherTopicsController {
  constructor(private readonly teacherTopicsService: TeacherTopicsService) {}

  @ApiOperation({ summary: 'List teacher topics by teacherId (default: non-deleted)' })
  @Get()
  findAll(@Query('teacherId') teacherId: string) {
    return this.teacherTopicsService.findAll(teacherId);
  }

  @ApiOperation({ summary: 'List soft-deleted teacher topics' })
  @Get('deleted')
  findDeleted(@Query('teacherId') teacherId?: string) {
    return this.teacherTopicsService.findDeleted(teacherId);
  }

  @ApiOperation({ summary: 'Get a single teacher topic by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teacherTopicsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new teacher topic' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.teacherTopicsService.create(body);
  }

  @ApiOperation({ summary: 'Update a teacher topic' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.teacherTopicsService.update(id, body);
  }

  @ApiOperation({ summary: 'Soft-delete a teacher topic' })
  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.teacherTopicsService.softDelete(id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted teacher topic' })
  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string) {
    return this.teacherTopicsService.restore(id);
  }

  @ApiOperation({ summary: 'Permanently delete a teacher topic' })
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.teacherTopicsService.permanentDelete(id);
  }
}
