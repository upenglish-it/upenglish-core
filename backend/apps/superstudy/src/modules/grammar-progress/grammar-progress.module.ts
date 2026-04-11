import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTGrammarExercises,
  SSTGrammarProgress,
  SSTGrammarQuestions,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { GrammarProgressController } from './grammar-progress.controller';
import { GrammarProgressService } from './grammar-progress.service';

@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTGrammarProgress,
      SSTGrammarQuestions,
      SSTGrammarExercises,
    ]),
  ],
  controllers: [GrammarProgressController],
  providers: [GrammarProgressService],
  exports: [GrammarProgressService],
})
export class GrammarProgressModule {}
