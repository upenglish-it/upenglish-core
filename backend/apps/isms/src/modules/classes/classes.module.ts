import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  Cashflow,
  Classes,
  ClassesDay,
  ClassesTime,
  StudentsSavingsBreakdown,
  Notifications,
  StudentsTuitionAttendance,
  SchedulesShifts,
  Accounts,
  Courses,
  ActivityLogs,
  StudentsTuitionAttendanceDraft,
} from 'apps/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { ClassesDaysController } from './classes-days.controller';
import { ClassesTimeController } from './classes-time.controller';
import { InactiveAccountScheduler } from '../scheduler/inactive-account.scheduler';
import { AgendaModule } from 'agenda-nest';

@Module({
  imports: [
    TypegooseModule.forFeature([
      Classes,
      ClassesDay,
      ClassesTime,
      StudentsTuitionAttendance,
      Notifications,
      Cashflow,
      SchedulesShifts,
      Accounts,
      Courses,
      ActivityLogs,
      StudentsSavingsBreakdown,
      StudentsTuitionAttendanceDraft,
    ]),
    AgendaModule.registerQueue('inactive-account-scheduler', {
      autoStart: true,
      collection: 'inactive-account-scheduler',
    }),
  ],
  controllers: [ClassesController, ClassesDaysController, ClassesTimeController],
  providers: [ClassesService, InactiveAccountScheduler],
})
export class ClassesModule {}
