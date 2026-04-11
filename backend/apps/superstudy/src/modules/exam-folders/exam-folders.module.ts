import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTExamFolders } from 'apps/common/src/database/mongodb/src/superstudy';
import { ExamFoldersService } from './exam-folders.service';
import { ExamFoldersController } from './exam-folders.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTExamFolders])],
  controllers: [ExamFoldersController],
  providers: [ExamFoldersService],
  exports: [ExamFoldersService],
})
export class ExamFoldersModule {}
