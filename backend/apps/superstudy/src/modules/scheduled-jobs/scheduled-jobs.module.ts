import { Module } from '@nestjs/common';
import { AgendaModule } from 'agenda-nest';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTAssignments,
  SSTExamAssignments,
  SSTExamSubmissions,
  SSTNotifications,
  SSTMailQueue,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';
import { ScheduledJobsService } from './scheduled-jobs.service';

@Module({
  imports: [
    AgendaModule.registerQueue(''),
    TypegooseModule.forFeature([
      SSTAssignments,
      SSTExamAssignments,
      SSTExamSubmissions,
      SSTNotifications,
      SSTMailQueue,
      Accounts,
    ]),
  ],
  providers: [ScheduledJobsService],
  exports: [ScheduledJobsService],
})
export class ScheduledJobsModule {}
