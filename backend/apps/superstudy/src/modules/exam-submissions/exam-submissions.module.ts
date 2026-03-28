import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTExamSubmissions,
  SSTExams,
  SSTExamQuestions,
  SSTUsers,
  SSTNotifications,
  SSTExamAssignments,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { ExamSubmissionsController } from './exam-submissions.controller';
import { ExamSubmissionsService } from './exam-submissions.service';
import { AutoSubmitExamsJob } from './jobs/auto-submit-exams.job';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTExamSubmissions,
      SSTExams,
      SSTExamQuestions,
      SSTUsers,
      SSTNotifications,
      SSTExamAssignments,
    ]),
    AiModule,
  ],
  controllers: [ExamSubmissionsController],
  providers: [ExamSubmissionsService, AutoSubmitExamsJob],
  exports: [ExamSubmissionsService],
})
export class ExamSubmissionsModule {}
