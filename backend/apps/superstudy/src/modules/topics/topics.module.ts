import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { AWSS3Service } from 'apps/common';
import { SSTTeacherTopics, SSTTopics } from 'apps/common/src/database/mongodb/src/superstudy';
import { TopicsController } from './topics.controller';
import { TopicsService } from './topics.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTTopics, SSTTeacherTopics])],
  controllers: [TopicsController],
  providers: [TopicsService, AWSS3Service],
  exports: [TopicsService],
})
export class TopicsModule {}
