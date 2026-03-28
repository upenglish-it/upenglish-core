import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTUsers } from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts, Properties, PropertiesBranches } from 'apps/common/src/database/mongodb/src/isms';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTUsers, Accounts, Properties, PropertiesBranches])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
