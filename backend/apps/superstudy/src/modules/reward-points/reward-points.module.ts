import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTRewardPointHistory, SSTRewardPoints } from 'apps/common/src/database/mongodb/src/superstudy';
import { RewardPointsService } from './reward-points.service';
import { RewardPointsController } from './reward-points.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTRewardPoints, SSTRewardPointHistory])],
  controllers: [RewardPointsController],
  providers: [RewardPointsService],
  exports: [RewardPointsService],
})
export class RewardPointsModule {}
