import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTRedFlags } from 'apps/common/src/database/mongodb/src/superstudy';
import { RedFlagsService } from './red-flags.service';
import { RedFlagsController } from './red-flags.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTRedFlags])],
  controllers: [RedFlagsController],
  providers: [RedFlagsService],
  exports: [RedFlagsService],
})
export class RedFlagsModule {}
