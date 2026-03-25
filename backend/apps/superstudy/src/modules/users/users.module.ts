import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTUsers } from 'apps/common/src/database/mongodb/src/superstudy';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTUsers])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
