import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTExams,
  SSTExamQuestions,
  SSTExamAssignments,
  SSTExamSubmissions,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';

@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTExams,
      SSTExamQuestions,
      SSTExamAssignments,
      SSTExamSubmissions,
    ]),
  ],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
