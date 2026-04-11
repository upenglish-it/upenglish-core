import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  SSTAssignments,
  SSTMailQueue,
  SSTNotifications,
  SSTUserGroups,
} from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  imports: [
    TypegooseModule.forFeature([
      SSTAssignments,
      SSTUserGroups,
      Accounts,
      SSTNotifications,
      SSTMailQueue,
    ]),
  ],
  controllers: [AssignmentsController],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
