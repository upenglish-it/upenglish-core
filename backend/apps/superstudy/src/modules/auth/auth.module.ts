import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, Properties, PropertiesBranches } from 'apps/common';
import { SSTEmailWhitelist, SSTMailQueue, SSTNotifications, SSTUserGroups } from 'apps/common/src/database/mongodb/src/superstudy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    TypegooseModule.forFeature([Accounts, Properties, PropertiesBranches, SSTEmailWhitelist, SSTNotifications, SSTMailQueue, SSTUserGroups]),
  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
