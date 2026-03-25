import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GrammarQuestionsService } from './grammar-questions.service';

@ApiTags('Grammar Questions')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('grammar-questions')
export class GrammarQuestionsController {
  constructor(private readonly grammarQuestionsService: GrammarQuestionsService) {}

  @ApiOperation({ summary: 'List questions for a grammar exercise (ordered)' })
  @Get()
  findAll(@Query('exerciseId') exerciseId: string) {
    return this.grammarQuestionsService.findAll(exerciseId);
  }

  @ApiOperation({ summary: 'Get a single grammar question by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.grammarQuestionsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a grammar question (auto-assigns order)' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.grammarQuestionsService.create(body);
  }

  @ApiOperation({ summary: 'Update a grammar question' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.grammarQuestionsService.update(id, body);
  }

  @ApiOperation({ summary: 'Delete a grammar question (hard)' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.grammarQuestionsService.remove(id);
  }

  @ApiOperation({ summary: 'Bulk reorder grammar questions' })
  @Patch('order/batch')
  @HttpCode(HttpStatus.OK)
  reorder(@Body() body: Array<{ id: string; order: number }>) {
    return this.grammarQuestionsService.reorder(body);
  }
}
