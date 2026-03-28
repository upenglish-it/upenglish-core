import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTUsers,
  SSTWordProgress,
  SSTNotifications,
  SSTExamSubmissions,
  SSTMailQueue,
  SSTEmailWhitelist,
  SSTRewardPoints,
  SSTRedFlags,
  SSTSkillReports,
  SSTReportPeriods,
  SSTTeacherRatings,
  SSTTeacherRatingSummaries,
  SSTAnonymousFeedback,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { WordProgressModule } from '../word-progress/word-progress.module';

@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTUsers,
      SSTWordProgress,
      SSTNotifications,
      SSTExamSubmissions,
      SSTMailQueue,
      SSTEmailWhitelist,
      SSTRewardPoints,
      SSTRedFlags,
      SSTSkillReports,
      SSTReportPeriods,
      SSTTeacherRatings,
      SSTTeacherRatingSummaries,
      SSTAnonymousFeedback,
    ]),
    WordProgressModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
