import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTeacherRatingSummaries } from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherRatingSummariesService } from './teacher-rating-summaries.service';
import { TeacherRatingSummariesController } from './teacher-rating-summaries.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTTeacherRatingSummaries])],
  controllers: [TeacherRatingSummariesController],
  providers: [TeacherRatingSummariesService],
  exports: [TeacherRatingSummariesService],
})
export class TeacherRatingSummariesModule {}
