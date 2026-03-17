import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, SchedulesShifts, StudentsTuitionAttendance } from 'apps/common';
import { SchedulesShiftsController } from './shifts.controller';
import { SchedulesShiftsService } from './shifts.service';

@Module({
  imports: [
    TypegooseModule.forFeature([
      // Schedules,
      SchedulesShifts,
      Accounts,
      StudentsTuitionAttendance,
    ]),
  ],
  controllers: [SchedulesShiftsController],
  providers: [SchedulesShiftsService],
})
export class SchedulesShiftsModule {}
