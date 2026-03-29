import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTContentProposals } from 'apps/common/src/database/mongodb/src/superstudy';
import { ContentProposalsService } from './content-proposals.service';
import { ContentProposalsController } from './content-proposals.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTContentProposals])],
  controllers: [ContentProposalsController],
  providers: [ContentProposalsService]
})
export class ContentProposalsModule {}
