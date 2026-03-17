import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, AccountsProperties, AccountsRoles, Notifications, Properties, PropertiesBranches, RolesPermissions, VerificationLogs } from 'apps/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AccountsService } from '../accounts/accounts.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, AccountsProperties, AccountsRoles, Notifications, VerificationLogs, RolesPermissions, Properties, PropertiesBranches])],
  controllers: [NotificationsController],
  providers: [NotificationsService, AccountsService],
})
export class NotificationsModule {}
