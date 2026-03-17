// Nestjs imports
import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
// Tasks Modules
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
// Commons
import {
  IELTSTasks,
  IELTSPrompts,
  IELTSTestsOfClassPeriodsSections,
  IELTSTestsOfClassPeriodsSectionsTests,
  IELTSTestsOfClassPeriodsSectionsTestsStudent,
  IELTSTestsOfClassPeriodsSectionsTestsTimeline,
} from 'apps/common';

@Module({
  imports: [
    TypegooseModule.forFeature([
      IELTSTasks,
      IELTSPrompts,
      IELTSTestsOfClassPeriodsSections,
      IELTSTestsOfClassPeriodsSectionsTests,
      IELTSTestsOfClassPeriodsSectionsTestsTimeline,
      IELTSTestsOfClassPeriodsSectionsTestsStudent,
    ]),
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
