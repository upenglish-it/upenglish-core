import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExamSubmissionsService } from './exam-submissions.service';

@ApiTags('Exam Submissions')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('exam-submissions')
export class ExamSubmissionsController {
  constructor(private readonly examSubmissionsService: ExamSubmissionsService) {}

  @ApiOperation({ summary: 'Lookup a submission by assignmentId + studentId' })
  @Get('lookup')
  lookup(
    @Query('assignmentId') assignmentId: string,
    @Query('studentId') studentId: string,
  ) {
    return this.examSubmissionsService.lookup(assignmentId, studentId);
  }

  @ApiOperation({ summary: 'List submissions (filter by assignmentId, studentId, or comma-sep assignmentIds)' })
  @Get()
  findAll(
    @Query('assignmentId') assignmentId?: string,
    @Query('studentId') studentId?: string,
    @Query('assignmentIds') assignmentIds?: string,
  ) {
    if (assignmentIds) {
      const ids = assignmentIds.split(',').filter(Boolean);
      return this.examSubmissionsService.findByAssignments(ids);
    }
    return this.examSubmissionsService.findAll({ assignmentId, studentId });
  }

  @ApiOperation({ summary: 'Get a single submission by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examSubmissionsService.findOne(id);
  }

  @ApiOperation({ summary: 'Start an exam (create submission)' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.examSubmissionsService.create(body);
  }

  @ApiOperation({ summary: 'Save progress / submit answers / submit exam' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.examSubmissionsService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a submission (hard delete)' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examSubmissionsService.remove(id);
  }

  @ApiOperation({ summary: 'Release exam results to student' })
  @Patch(':id/release')
  @HttpCode(HttpStatus.OK)
  release(
    @Param('id') id: string,
    @Body() body: { releasedBy: string; releasedByName?: string },
  ) {
    return this.examSubmissionsService.releaseResults(id, body.releasedBy, body.releasedByName);
  }

  @ApiOperation({ summary: 'Release follow-up results to student' })
  @Patch(':id/release-follow-up')
  @HttpCode(HttpStatus.OK)
  releaseFollowUp(
    @Param('id') id: string,
    @Body() body: { releasedBy: string; releasedByName?: string },
  ) {
    return this.examSubmissionsService.releaseFollowUpResults(
      id,
      body.releasedBy,
      body.releasedByName,
    );
  }

  @ApiOperation({ summary: 'Mark results as viewed by student' })
  @Patch(':id/viewed')
  @HttpCode(HttpStatus.OK)
  markViewed(@Param('id') id: string) {
    return this.examSubmissionsService.markViewed(id);
  }

  @ApiOperation({ summary: 'Mark follow-up results as viewed by student' })
  @Patch(':id/viewed-follow-up')
  @HttpCode(HttpStatus.OK)
  markFollowUpViewed(@Param('id') id: string) {
    return this.examSubmissionsService.markFollowUpViewed(id);
  }
}
