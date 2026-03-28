import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTAppConfig } from 'apps/common/src/database/mongodb/src/superstudy';
import { AppConfigService } from './app-config.service';
import { AppConfigController } from './app-config.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTAppConfig])],
  controllers: [AppConfigController],
  providers: [AppConfigService],
  exports: [AppConfigService],  // exported so AiModule can inject it
})
export class AppConfigModule {}
