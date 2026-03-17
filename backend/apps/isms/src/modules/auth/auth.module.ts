import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  Accounts,
  AccountsProperties,
  AccountsRoles,
  Properties,
  PropertiesBranches,
  RolesPermissions,
  StudentsTuitionAttendance,
  VerificationLogs,
} from 'apps/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountsService } from '../accounts/accounts.service';

@Module({
  imports: [
    TypegooseModule.forFeature([
      Accounts,
      AccountsProperties,
      AccountsRoles,
      Properties,
      PropertiesBranches,
      RolesPermissions,
      VerificationLogs,
      StudentsTuitionAttendance,
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccountsService],
})
export class AuthModule {}
