import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, AccountsProperties, AccountsRoles, Properties, PropertiesBranches, RolesPermissions, VerificationLogs } from 'apps/common';
import { LockScreenController } from './lock-screen.controller';
import { LockScreenService } from './lock-screen.service';
import { AccountsService } from '../accounts/accounts.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, AccountsProperties, AccountsRoles, VerificationLogs, RolesPermissions, Properties, PropertiesBranches])],
  controllers: [LockScreenController],
  providers: [LockScreenService, AccountsService],
})
export class LockScreenModule {}
