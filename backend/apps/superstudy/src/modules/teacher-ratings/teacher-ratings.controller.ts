import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TeacherRatingsService } from './teacher-ratings.service';

@ApiTags('Teacher Ratings')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('teacher-ratings')
export class TeacherRatingsController {
  constructor(private readonly service: TeacherRatingsService) {}

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
