import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExamAssignmentsService } from './exam-assignments.service';

@ApiTags('Exam Assignments')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('exam-assignments')
export class ExamAssignmentsController {
  constructor(private readonly examAssignmentsService: ExamAssignmentsService) {}

  @ApiOperation({ summary: 'List exam assignments. Filter by examId, groupId, or studentId.' })
  @Get()
  findAll(
    @Query('examId') examId?: string,
    @Query('groupId') groupId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.examAssignmentsService.findAll({ examId, groupId, studentId });
  }

  @ApiOperation({ summary: 'List soft-deleted assignments for a group' })
  @Get('deleted')
  findDeleted(@Query('groupId') groupId?: string) {
    return this.examAssignmentsService.findDeleted(groupId);
  }

  @ApiOperation({ summary: 'Get a single exam assignment by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examAssignmentsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new exam assignment (notifies group/students)' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.examAssignmentsService.create(body);
  }

  @ApiOperation({ summary: 'Update assignment due date (+ optionally notify)' })
  @Patch(':id/due-date')
  @HttpCode(HttpStatus.OK)
  updateDueDate(
    @Param('id') id: string,
    @Body() body: { dueDate: string; notify?: boolean },
  ) {
    return this.examAssignmentsService.updateDueDate(id, new Date(body.dueDate), body.notify);
  }

  @ApiOperation({ summary: 'Soft-delete an assignment' })
  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.examAssignmentsService.softDelete(id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted assignment' })
  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string) {
    return this.examAssignmentsService.restore(id);
  }

  @ApiOperation({ summary: 'Permanently delete an assignment and all its submissions' })
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.examAssignmentsService.permanentDelete(id);
  }
}
