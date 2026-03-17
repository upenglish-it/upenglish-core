import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, Classes, Notifications, StudentsTuitionAttendance, Tasks, TasksSubmissions, TasksSubmissionsInstances } from 'apps/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksSubmissionsService } from './tasks-submissions.service';

@Module({
  imports: [TypegooseModule.forFeature([Tasks, TasksSubmissions, Accounts, Classes, StudentsTuitionAttendance, TasksSubmissionsInstances, Notifications])],
  controllers: [TasksController],
  providers: [TasksService, TasksSubmissionsService],
})
export class TasksModule {}
