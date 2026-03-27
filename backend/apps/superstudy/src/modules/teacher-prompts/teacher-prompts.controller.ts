import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherPromptsService } from './teacher-prompts.service';

@ApiTags('Teacher Prompts')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('teacher-prompts')
export class TeacherPromptsController {
  constructor(private readonly service: TeacherPromptsService) {}

  @ApiOperation({ summary: 'Get all prompts for a teacher' })
  @Get()
  getTeacherPrompts(@Query('teacherId') teacherId: string) {
    return this.service.getTeacherPrompts(teacherId);
  }

  @ApiOperation({ summary: 'Get all prompts (admin)' })
  @Get('all')
  getAllPrompts() {
    return this.service.getAllPrompts();
  }

  @ApiOperation({ summary: 'Get a single prompt by ID' })
  @Get(':id')
  getPromptById(@Param('id') id: string) {
    return this.service.getPromptById(id);
  }

  @ApiOperation({ summary: 'Create a new prompt' })
  @Post()
  createPrompt(@Body() body: Record<string, any>) {
    return this.service.createPrompt(body);
  }

  @ApiOperation({ summary: 'Update an existing prompt' })
  @Patch(':id')
  updatePrompt(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updatePrompt(id, body);
  }

  @ApiOperation({ summary: 'Delete a prompt' })
  @Delete(':id')
  deletePrompt(@Param('id') id: string) {
    return this.service.deletePrompt(id);
  }
}
