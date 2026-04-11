import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTSkillReports } from 'apps/common/src/database/mongodb/src/superstudy';
import { SkillReportsService } from './skill-reports.service';
import { SkillReportsController } from './skill-reports.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTSkillReports])],
  controllers: [SkillReportsController],
  providers: [SkillReportsService],
  exports: [SkillReportsService],
})
export class SkillReportsModule {}
