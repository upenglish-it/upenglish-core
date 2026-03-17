import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Leaves } from 'apps/common';
import { LeavesController } from './leaves.controller';
import { LeavesService } from './leaves.service';

@Module({
  imports: [TypegooseModule.forFeature([Leaves])],
  controllers: [LeavesController],
  providers: [LeavesService],
})
export class LeavesModule {}
