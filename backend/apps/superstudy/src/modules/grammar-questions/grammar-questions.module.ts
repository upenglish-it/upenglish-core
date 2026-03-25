import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTGrammarQuestions, SSTGrammarExercises } from 'apps/common/src/database/mongodb/src/superstudy';
import { GrammarQuestionsController } from './grammar-questions.controller';
import { GrammarQuestionsService } from './grammar-questions.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTGrammarQuestions, SSTGrammarExercises])],
  controllers: [GrammarQuestionsController],
  providers: [GrammarQuestionsService],
  exports: [GrammarQuestionsService],
})
export class GrammarQuestionsModule {}
