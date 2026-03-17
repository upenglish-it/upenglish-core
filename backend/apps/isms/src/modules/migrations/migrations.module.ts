import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, AccountsProperties, Classes, Courses, StudentsTuitionAttendance } from 'apps/common';
import { MigrationsController } from './migrations.controller';
import { MigrationsService } from './migrations.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, AccountsProperties, Classes, Courses, StudentsTuitionAttendance])],
  controllers: [MigrationsController],
  providers: [MigrationsService],
})
export class MigrationsModule {}
