import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Cashflow, StaffsSalaryPayment, StudentsTuitionAttendance } from 'apps/common';
import { ProfOfPaymentService } from './pop.service';
import { ProfOfPaymentController } from './pop.controller';

@Module({
  imports: [TypegooseModule.forFeature([StaffsSalaryPayment, StudentsTuitionAttendance, Cashflow])],
  controllers: [ProfOfPaymentController],
  providers: [ProfOfPaymentService],
})
export class ProfOfPaymentModule {}
