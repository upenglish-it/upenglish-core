import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTTopicFolders,
  SSTGrammarFolders,
  SSTExamFolders,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { AdminFoldersController } from './admin-folders.controller';
import { AdminFoldersService } from './admin-folders.service';

/**
 * AdminFoldersModule — manages the 3 admin-owned folder types:
 *   - topic_folders  (SSTTopicFolders)
 *   - grammar_folders (SSTGrammarFolders)
 *   - exam_folders   (SSTExamFolders)
 *
 * Mirrors getFolders/saveFolder/deleteFolder/updateFoldersOrder from adminService.js.
 */
@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTTopicFolders,
      SSTGrammarFolders,
      SSTExamFolders,
    ]),
  ],
  controllers: [AdminFoldersController],
  providers: [AdminFoldersService],
  exports: [AdminFoldersService],
})
export class AdminFoldersModule {}
