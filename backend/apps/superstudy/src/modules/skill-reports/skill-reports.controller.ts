import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkillReportsService } from './skill-reports.service';

@ApiTags('Skill Reports')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('skill-reports')
export class SkillReportsController {
  constructor(private readonly service: SkillReportsService) {}

  @ApiOperation({ summary: 'Check if an assignment is in a sent report' })
  @Get('check-lock')
  checkLock(
    @Query('field') field: string,
    @Query('assignmentId') assignmentId: string,
  ) {
    return this.service.checkLock(field, assignmentId);
  }

  @ApiOperation({ summary: 'Get all with optional filters' })
  @Get()
  findAll(@Query() query: Record<string, any>) {
    return this.service.findAll(query);
  }

  @ApiOperation({ summary: 'Get by id' })
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @ApiOperation({ summary: 'Create' })
  @Post()
  create(@Body() body: Record<string, any>) {
    return this.service.create(body);
  }

  @ApiOperation({ summary: 'Update' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update(id, body);
  }

  @ApiOperation({ summary: 'Delete' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
