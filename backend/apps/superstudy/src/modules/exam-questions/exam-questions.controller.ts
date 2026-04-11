import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ExamQuestionsService } from './exam-questions.service';

@ApiTags('Exam Questions')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('exam-questions')
export class ExamQuestionsController {
  constructor(private readonly examQuestionsService: ExamQuestionsService) {}

  @ApiOperation({ summary: 'Get question counts per exam (comma-separated examIds)' })
  @Get('counts')
  getCounts(@Query('examIds') examIds: string) {
    const ids = examIds?.split(',').filter(Boolean) || [];
    return this.examQuestionsService.getCounts(ids);
  }

  @ApiOperation({ summary: 'Get time totals per exam (comma-separated examIds)' })
  @Get('time-totals')
  getTimeTotals(@Query('examIds') examIds: string) {
    const ids = examIds?.split(',').filter(Boolean) || [];
    return this.examQuestionsService.getTimeTotals(ids);
  }

  @ApiOperation({ summary: 'Bulk reorder questions (array of { id, order })' })
  @Patch('order/batch')
  @HttpCode(HttpStatus.OK)
  reorder(@Body() body: Array<{ id: string; order: number }>) {
    return this.examQuestionsService.reorder(body);
  }

  @ApiOperation({ summary: 'List questions for an exam (sorted by order). Optional sectionId filter.' })
  @Get()
  findAll(
    @Query('examId') examId: string,
    @Query('sectionId') sectionId?: string,
  ) {
    return this.examQuestionsService.findAll(examId, sectionId);
  }

  @ApiOperation({ summary: 'Get a single exam question by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.examQuestionsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new exam question (auto-assigns order)' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.examQuestionsService.create(body);
  }

  @ApiOperation({ summary: 'Update an exam question' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.examQuestionsService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a question (hard delete)' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.examQuestionsService.remove(id);
  }
}
