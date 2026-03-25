import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExamsService } from './exams.service';

@ApiTags('Exams')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('exams')
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  @ApiOperation({ summary: 'List exams (optionally filter by createdByRole)' })
  @Get()
  findAll(@Query('createdByRole') createdByRole?: string) {
    return this.examsService.findAll(createdByRole);
  }

  @ApiOperation({ summary: 'List public + teacherVisible + individually shared exams' })
  @Get('shared')
  findShared(@Query('examAccessIds') examAccessIds?: string) {
    const ids = examAccessIds ? examAccessIds.split(',').filter(Boolean) : [];
    return this.examsService.findShared(ids);
  }

  @ApiOperation({ summary: 'List soft-deleted exams' })
  @Get('deleted')
  findDeleted() {
    return this.examsService.findDeleted();
  }

  @ApiOperation({ summary: 'Get a single exam by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new exam' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.examsService.create(body);
  }

  @ApiOperation({ summary: 'Update exam (name, sections, settings, etc.)' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.examsService.update(id, body);
  }

  @ApiOperation({ summary: 'Soft-delete exam (isDeleted = true)' })
  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.examsService.softDelete(id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted exam' })
  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string) {
    return this.examsService.restore(id);
  }

  @ApiOperation({ summary: 'Permanently delete exam (cascades questions + assignments + submissions)' })
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.examsService.permanentDelete(id);
  }

  @ApiOperation({ summary: 'Recalculate and cache question counts for an exam' })
  @Post(':id/recalc-cache')
  @HttpCode(HttpStatus.OK)
  recalcCache(@Param('id') id: string) {
    return this.examsService.recalcQuestionCache(id);
  }
}
