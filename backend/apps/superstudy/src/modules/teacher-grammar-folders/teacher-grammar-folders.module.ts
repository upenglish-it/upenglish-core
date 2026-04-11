import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTeacherGrammarFolders } from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherGrammarFoldersService } from './teacher-grammar-folders.service';
import { TeacherGrammarFoldersController } from './teacher-grammar-folders.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTTeacherGrammarFolders])],
  controllers: [TeacherGrammarFoldersController],
  providers: [TeacherGrammarFoldersService],
  exports: [TeacherGrammarFoldersService],
})
export class TeacherGrammarFoldersModule {}
