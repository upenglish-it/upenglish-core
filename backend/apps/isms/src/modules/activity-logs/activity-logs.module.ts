import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { ActivityLogs } from 'apps/common';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';

@Module({
  imports: [TypegooseModule.forFeature([ActivityLogs])],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
})
export class ActivityLogsModule {}
