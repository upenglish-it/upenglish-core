import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTExamQuestions, SSTExams } from 'apps/common/src/database/mongodb/src/superstudy';
import { ExamQuestionsController } from './exam-questions.controller';
import { ExamQuestionsService } from './exam-questions.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTExamQuestions, SSTExams])],
  controllers: [ExamQuestionsController],
  providers: [ExamQuestionsService],
  exports: [ExamQuestionsService],
})
export class ExamQuestionsModule {}
