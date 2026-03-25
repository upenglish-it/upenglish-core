import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';

@ApiTags('Assignments')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @ApiOperation({ summary: 'List assignments for a group (optionally filter by topicId/isGrammar)' })
  @Get()
  findAll(
    @Query('groupId') groupId?: string,
    @Query('topicId') topicId?: string,
    @Query('isGrammar') isGrammar?: string,
  ) {
    return this.assignmentsService.findAll({
      groupId,
      topicId,
      isGrammar: isGrammar === 'true' ? true : isGrammar === 'false' ? false : undefined,
    });
  }

  @ApiOperation({ summary: 'Get a single assignment by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.assignmentsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a vocabulary/grammar topic assignment' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.assignmentsService.create(body);
  }

  @ApiOperation({ summary: 'Update assignment (dueDate, constraints, etc.)' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.assignmentsService.update(id, body);
  }

  @ApiOperation({ summary: 'Soft-delete an assignment' })
  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.assignmentsService.softDelete(id);
  }

  @ApiOperation({ summary: 'Permanently delete an assignment' })
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.assignmentsService.permanentDelete(id);
  }
}
