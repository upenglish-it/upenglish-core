import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, Cashflow, StaffsEmploymentInformation } from 'apps/common';
import { DashboardAdminController } from './admin.controller';
import { DashboardAdminService } from './admin.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, Cashflow, StaffsEmploymentInformation])],
  controllers: [DashboardAdminController],
  providers: [DashboardAdminService],
})
export class DashboardAdminModule {}
