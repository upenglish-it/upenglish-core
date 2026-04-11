import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTMailQueue } from 'apps/common/src/database/mongodb/src/superstudy';
import { Accounts } from 'apps/common/src/database/mongodb/src/isms';
import { MailQueueController } from './mail-queue.controller';
import { MailQueueService } from './mail-queue.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTMailQueue, Accounts])],
  controllers: [MailQueueController],
  providers: [MailQueueService],
  exports: [MailQueueService],
})
export class MailQueueModule {}
