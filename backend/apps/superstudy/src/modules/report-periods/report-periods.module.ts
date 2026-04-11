import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { 
  SSTReportPeriods, 
  SSTSettings, 
  SSTSkillReports, 
  SSTUserGroups 
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';
import { ReportPeriodsService } from './report-periods.service';
import { ReportPeriodsController } from './report-periods.controller';

@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTReportPeriods,
      SSTSettings,
      SSTSkillReports,
      SSTUserGroups,
      Accounts,
    ])
  ],
  controllers: [ReportPeriodsController],
  providers: [ReportPeriodsService],
  exports: [ReportPeriodsService],
})
export class ReportPeriodsModule {}
