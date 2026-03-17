import { Module } from '@nestjs/common';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, ActivityLogs, Notifications, Pipelines, PipelinesActivityLogs, PipelinesConversations, PipelinesNotes } from 'apps/common';

@Module({
  imports: [TypegooseModule.forFeature([Pipelines, PipelinesNotes, PipelinesActivityLogs, PipelinesConversations, Accounts, Notifications, ActivityLogs])],
  controllers: [PipelinesController],
  providers: [PipelinesService],
})
export class PipelinesModule {}
