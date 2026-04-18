import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherRatingsService } from './teacher-ratings.service';

@ApiTags('Teacher Ratings')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('teacher-ratings')
export class TeacherRatingsController {
  constructor(private readonly service: TeacherRatingsService) {}

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

  @ApiOperation({ summary: 'Get summary for a teacher in a period' })
  @Get('summary')
  getRatingSummary(@Query('periodId') periodId: string, @Query('teacherId') teacherId: string) {
    return this.service.getRatingSummary(periodId, teacherId);
  }

  @ApiOperation({ summary: 'Get all summaries for a period' })
  @Get('summaries/all')
  getAllSummariesForPeriod(@Query('periodId') periodId: string) {
    return this.service.getAllSummariesForPeriod(periodId);
  }
}
