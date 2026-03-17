import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  // Schedules,
  SchedulesShifts,
} from 'apps/common';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [
    TypegooseModule.forFeature([
      // Schedules,
      SchedulesShifts,
    ]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}
