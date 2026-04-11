import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTeacherExamFolders } from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherExamFoldersService } from './teacher-exam-folders.service';
import { TeacherExamFoldersController } from './teacher-exam-folders.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTTeacherExamFolders])],
  controllers: [TeacherExamFoldersController],
  providers: [TeacherExamFoldersService],
  exports: [TeacherExamFoldersService],
})
export class TeacherExamFoldersModule {}
