import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { ActivityLogs, Cashflow } from 'apps/common';
import { ExpensesService } from './expeses.service';
import { ExpensesController } from './expeses.controller';

@Module({
  imports: [TypegooseModule.forFeature([Cashflow, ActivityLogs])],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
