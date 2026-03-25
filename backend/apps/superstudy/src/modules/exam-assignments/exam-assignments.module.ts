import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTExamAssignments,
  SSTExamSubmissions,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { ExamAssignmentsController } from './exam-assignments.controller';
import { ExamAssignmentsService } from './exam-assignments.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTExamAssignments, SSTExamSubmissions])],
  controllers: [ExamAssignmentsController],
  providers: [ExamAssignmentsService],
  exports: [ExamAssignmentsService],
})
export class ExamAssignmentsModule {}
