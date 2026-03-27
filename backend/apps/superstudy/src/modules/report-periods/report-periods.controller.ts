import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportPeriodsService } from './report-periods.service';

@ApiTags('Report Periods')
@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@Controller('report-periods')
export class ReportPeriodsController {
  constructor(private readonly service: ReportPeriodsService) {}

  @ApiOperation({ summary: 'Get report period defaults from settings' })
  @Get('settings/defaults')
  getDefaults() {
    return this.service.getReportPeriodDefaults();
  }

  @ApiOperation({ summary: 'Save report period defaults to settings' })
  @Post('settings/defaults')
  saveDefaults(@Body() body: any) {
    return this.service.saveReportPeriodDefaults(body);
  }

  @ApiOperation({ summary: 'Auto-create period if needed' })
  @Post('actions/ensure-current')
  ensureCurrent() {
    return this.service.ensureCurrentPeriodExists();
  }

  @ApiOperation({ summary: 'Purge old soft-deleted periods' })
  @Post('actions/purge-expired')
  purgeExpired() {
    return this.service.purgeExpiredDeletedPeriods();
  }

  @ApiOperation({ summary: 'Get all soft-deleted periods' })
  @Get('deleted')
  getDeleted() {
    return this.service.getDeletedReportPeriods();
  }

  @ApiOperation({ summary: 'Get all valid periods' })
  @Get()
  getAll() {
    return this.service.getAllReportPeriods();
  }

  @ApiOperation({ summary: 'Create new report period' })
  @Post()
  createPeriod(@Body() body: Record<string, any>) {
    return this.service.createReportPeriod(body);
  }

  @ApiOperation({ summary: 'Update report period' })
  @Patch(':id')
  updatePeriod(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateReportPeriod(id, body);
  }

  @ApiOperation({ summary: 'Soft delete period' })
  @Delete(':id')
  deletePeriod(@Param('id') id: string) {
    return this.service.deleteReportPeriod(id);
  }

  @ApiOperation({ summary: 'Restore soft deleted period' })
  @Patch(':id/restore')
  restorePeriod(@Param('id') id: string) {
    return this.service.restoreReportPeriod(id);
  }

  @ApiOperation({ summary: 'Permanently delete period' })
  @Delete(':id/permanent')
  permanentlyDeletePeriod(@Param('id') id: string) {
    return this.service.permanentlyDeleteReportPeriod(id);
  }

  @ApiOperation({ summary: 'Get group report status' })
  @Get('stats/groups/:groupId')
  getGroupReportStatus(
    @Param('groupId') groupId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.service.getGroupReportStatus(groupId, startDate, endDate, periodId);
  }

  @ApiOperation({ summary: 'Get report stats for all teachers' })
  @Get('stats/teachers')
  getTeacherStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.service.getReportStatsForPeriod(startDate, endDate, periodId);
  }

  @ApiOperation({ summary: 'Get per-student report details for specific teacher' })
  @Get('stats/teachers/:teacherId')
  getTeacherDetails(
    @Param('teacherId') teacherId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.service.getTeacherReportDetails(teacherId, startDate, endDate, periodId);
  }
}
