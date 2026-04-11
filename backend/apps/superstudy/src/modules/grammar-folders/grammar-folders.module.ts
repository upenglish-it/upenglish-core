import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTGrammarFolders } from 'apps/common/src/database/mongodb/src/superstudy';
import { GrammarFoldersService } from './grammar-folders.service';
import { GrammarFoldersController } from './grammar-folders.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTGrammarFolders])],
  controllers: [GrammarFoldersController],
  providers: [GrammarFoldersService],
  exports: [GrammarFoldersService],
})
export class GrammarFoldersModule {}
