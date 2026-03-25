import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GrammarExercisesService } from './grammar-exercises.service';

@ApiTags('Grammar Exercises')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('grammar-exercises')
export class GrammarExercisesController {
  constructor(private readonly grammarExercisesService: GrammarExercisesService) {}

  @ApiOperation({ summary: 'List grammar exercises (optionally filter by createdByRole)' })
  @Get()
  findAll(@Query('createdByRole') createdByRole?: string) {
    return this.grammarExercisesService.findAll(createdByRole);
  }

  @ApiOperation({ summary: 'List public + teacherVisible + individually shared exercises' })
  @Get('shared')
  findShared(@Query('grammarAccessIds') grammarAccessIds?: string) {
    const ids = grammarAccessIds?.split(',').filter(Boolean) ?? [];
    return this.grammarExercisesService.findShared(ids);
  }

  @ApiOperation({ summary: 'List soft-deleted exercises' })
  @Get('deleted')
  findDeleted() {
    return this.grammarExercisesService.findDeleted();
  }

  @ApiOperation({ summary: 'Get a single grammar exercise by ID' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.grammarExercisesService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new grammar exercise' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.grammarExercisesService.create(body);
  }

  @ApiOperation({ summary: 'Update a grammar exercise' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.grammarExercisesService.update(id, body);
  }

  @ApiOperation({ summary: 'Soft-delete a grammar exercise' })
  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.grammarExercisesService.softDelete(id);
  }

  @ApiOperation({ summary: 'Restore a soft-deleted grammar exercise' })
  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string) {
    return this.grammarExercisesService.restore(id);
  }

  @ApiOperation({ summary: 'Permanently delete grammar exercise (cascades questions)' })
  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.grammarExercisesService.permanentDelete(id);
  }
}
