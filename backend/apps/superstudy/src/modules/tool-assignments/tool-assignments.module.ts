import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTToolAssignments } from 'apps/common/src/database/mongodb/src/superstudy';
import { ToolAssignmentsService } from './tool-assignments.service';
import { ToolAssignmentsController } from './tool-assignments.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTToolAssignments])],
  controllers: [ToolAssignmentsController],
  providers: [ToolAssignmentsService],
  exports: [ToolAssignmentsService],
})
export class ToolAssignmentsModule {}
