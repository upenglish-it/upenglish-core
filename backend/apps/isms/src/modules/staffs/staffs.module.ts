import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  Accounts,
  StaffsEmploymentInformation,
  StaffsSalaryAdvancement,
  Notifications,
  Cashflow,
  AccountsProperties,
  StaffsSalaryPayment,
  StaffsSalaryPackage,
  Leaves,
  SchedulesShifts,
} from 'apps/common';
import { StaffsService } from './staffs.service';
import { StaffsController } from './staffs.controller';

@Module({
  imports: [
    TypegooseModule.forFeature([
      Accounts,
      StaffsEmploymentInformation,
      StaffsSalaryPayment,
      Notifications,
      Cashflow,
      AccountsProperties,
      StaffsSalaryPackage,
      Leaves,
      SchedulesShifts,
      StaffsSalaryAdvancement,
    ]),
  ],
  controllers: [StaffsController],
  providers: [StaffsService],
})
export class StaffsModule {}
