import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTAssignments,
  SSTExamAssignments,
  SSTExamSubmissions,
  SSTTeacherRatings,
  SSTTeacherRatingSummaries,
  SSTSkillReports,
  SSTRedFlags,
  SSTNotifications,
  SSTAnonymousFeedback,
  SSTMailQueue,
  SSTEmailWhitelist,
  SSTRewardPoints,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts, Properties, PropertiesBranches } from 'apps/common/src/database/mongodb/src/isms';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypegooseModule.forFeature([
      Accounts,
      Properties,
      PropertiesBranches,
      SSTAssignments,
      SSTExamAssignments,
      SSTExamSubmissions,
      SSTTeacherRatings,
      SSTTeacherRatingSummaries,
      SSTSkillReports,
      SSTRedFlags,
      SSTNotifications,
      SSTAnonymousFeedback,
      SSTMailQueue,
      SSTEmailWhitelist,
      SSTRewardPoints,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
