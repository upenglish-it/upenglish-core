import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, AccountsProperties, AccountsRoles, Properties, PropertiesBranches, RolesPermissions, VerificationLogs } from 'apps/common';
import { LanguageController } from './language.controller';
import { LanguageService } from './language.service';
import { AccountsService } from '../accounts/accounts.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, AccountsProperties, AccountsRoles, VerificationLogs, RolesPermissions, Properties, PropertiesBranches])],
  controllers: [LanguageController],
  providers: [LanguageService, AccountsService],
})
export class LanguageModule {}
