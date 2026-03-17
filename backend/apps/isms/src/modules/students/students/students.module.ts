import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, AccountsProperties, ActivityLogs, Notifications, Pipelines, PipelinesActivityLogs, PipelinesConversations, PipelinesNotes, StudentsIndexingImport, Tags } from 'apps/common';
import { StudentsServiceService } from './students.service';
import { StudentsController } from './students.controller';
import { PipelinesService } from '../../pipelines/pipelines.service';

@Module({
  imports: [
    TypegooseModule.forFeature([Accounts, AccountsProperties, StudentsIndexingImport, Notifications, Pipelines, PipelinesNotes, PipelinesActivityLogs, PipelinesConversations, ActivityLogs, Tags]),
  ],
  controllers: [StudentsController],
  providers: [StudentsServiceService, PipelinesService],
})
export class StudentsModule {}
