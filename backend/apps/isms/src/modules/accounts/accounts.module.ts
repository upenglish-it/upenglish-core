import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, AccountsRoles, Properties, PropertiesBranches, VerificationLogs, AccountsProperties, RolesPermissions } from 'apps/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, AccountsProperties, AccountsRoles, Properties, PropertiesBranches, RolesPermissions, VerificationLogs])],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
