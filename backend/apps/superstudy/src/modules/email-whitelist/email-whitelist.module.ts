import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTEmailWhitelist } from 'apps/common/src/database/mongodb/src/superstudy';
import { EmailWhitelistController } from './email-whitelist.controller';
import { EmailWhitelistService } from './email-whitelist.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTEmailWhitelist])],
  controllers: [EmailWhitelistController],
  providers: [EmailWhitelistService],
  exports: [EmailWhitelistService],
})
export class EmailWhitelistModule {}
