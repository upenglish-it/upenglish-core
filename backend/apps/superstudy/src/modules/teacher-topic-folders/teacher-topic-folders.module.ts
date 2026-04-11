import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTeacherTopicFolders } from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherTopicFoldersService } from './teacher-topic-folders.service';
import { TeacherTopicFoldersController } from './teacher-topic-folders.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTTeacherTopicFolders])],
  controllers: [TeacherTopicFoldersController],
  providers: [TeacherTopicFoldersService],
  exports: [TeacherTopicFoldersService],
})
export class TeacherTopicFoldersModule {}
