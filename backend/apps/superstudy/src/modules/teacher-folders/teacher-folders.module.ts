import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTTeacherTopicFolders,
  SSTTeacherGrammarFolders,
  SSTTeacherExamFolders,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherFoldersController } from './teacher-folders.controller';
import { TeacherFoldersService } from './teacher-folders.service';

/**
 * TeacherFoldersModule — manages the 3 teacher-owned folder types:
 *   - teacher_topic_folders   (SSTTeacherTopicFolders)
 *   - teacher_grammar_folders (SSTTeacherGrammarFolders)
 *   - teacher_exam_folders    (SSTTeacherExamFolders)
 *
 * Mirrors getTeacherTopicFolders/saveTeacherTopicFolder/deleteTeacherTopicFolder/
 * restoreTeacherTopicFolder/permanentlyDeleteTeacherTopicFolder/updateTeacherTopicFoldersOrder
 * from teacherService.js.
 */
@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTTeacherTopicFolders,
      SSTTeacherGrammarFolders,
      SSTTeacherExamFolders,
    ]),
  ],
  controllers: [TeacherFoldersController],
  providers: [TeacherFoldersService],
  exports: [TeacherFoldersService],
})
export class TeacherFoldersModule {}
