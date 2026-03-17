import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, ActivityLogs, Cashflow, Materials, Notifications, StudentsTuitionAttendance } from 'apps/common';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
// import { StudentsTuitionAttendanceService } from '../../students/students-tuition-attendance/students-tuition-attendance.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, Cashflow, Notifications, StudentsTuitionAttendance, Materials, StudentsTuitionAttendance, ActivityLogs])],
  controllers: [IncomeController],
  providers: [
    IncomeService,
    // StudentsTuitionAttendanceService
  ],
})
export class IncomeModule {}
