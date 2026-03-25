import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTGrammarExercises,
  SSTGrammarQuestions,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { GrammarExercisesController } from './grammar-exercises.controller';
import { GrammarExercisesService } from './grammar-exercises.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTGrammarExercises, SSTGrammarQuestions])],
  controllers: [GrammarExercisesController],
  providers: [GrammarExercisesService],
  exports: [GrammarExercisesService],
})
export class GrammarExercisesModule {}
