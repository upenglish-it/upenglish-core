import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTopicFolders } from 'apps/common/src/database/mongodb/src/superstudy';
import { TopicFoldersService } from './topic-folders.service';
import { TopicFoldersController } from './topic-folders.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTTopicFolders])],
  controllers: [TopicFoldersController],
  providers: [TopicFoldersService],
  exports: [TopicFoldersService],
})
export class TopicFoldersModule {}
