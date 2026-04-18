import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTUserGroups } from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';
import { UserGroupsController } from './user-groups.controller';
import { UserGroupsService } from './user-groups.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTUserGroups, Accounts])],
  controllers: [UserGroupsController],
  providers: [UserGroupsService],
  exports: [UserGroupsService],
})
export class UserGroupsModule {}
