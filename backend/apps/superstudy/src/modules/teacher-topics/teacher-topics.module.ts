import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTeacherTopics } from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherTopicsController } from './teacher-topics.controller';
import { TeacherTopicsService } from './teacher-topics.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTTeacherTopics])],
  controllers: [TeacherTopicsController],
  providers: [TeacherTopicsService],
  exports: [TeacherTopicsService],
})
export class TeacherTopicsModule {}
