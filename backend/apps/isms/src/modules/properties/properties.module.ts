import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, PropertiesBranches, Properties } from 'apps/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, Properties, PropertiesBranches])],
  controllers: [PropertiesController],
  providers: [PropertiesService],
})
export class PropertiesModule {}
