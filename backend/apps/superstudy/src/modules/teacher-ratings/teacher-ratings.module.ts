import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTeacherRatings, SSTTeacherRatingSummaries } from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherRatingsController } from './teacher-ratings.controller';
import { TeacherRatingsService } from './teacher-ratings.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTTeacherRatings, SSTTeacherRatingSummaries])],
  controllers: [TeacherRatingsController],
  providers: [TeacherRatingsService],
  exports: [TeacherRatingsService],
})
export class TeacherRatingsModule {}
