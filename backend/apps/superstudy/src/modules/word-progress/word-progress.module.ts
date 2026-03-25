import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTWordProgress } from 'apps/common/src/database/mongodb/src/superstudy';
import { WordProgressController } from './word-progress.controller';
import { WordProgressService } from './word-progress.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTWordProgress])],
  controllers: [WordProgressController],
  providers: [WordProgressService],
  exports: [WordProgressService],
})
export class WordProgressModule {}
