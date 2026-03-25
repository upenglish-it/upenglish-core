import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTExamSubmissions } from 'apps/common/src/database/mongodb/src/superstudy';
import { ExamSubmissionsController } from './exam-submissions.controller';
import { ExamSubmissionsService } from './exam-submissions.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTExamSubmissions])],
  controllers: [ExamSubmissionsController],
  providers: [ExamSubmissionsService],
  exports: [ExamSubmissionsService],
})
export class ExamSubmissionsModule {}
