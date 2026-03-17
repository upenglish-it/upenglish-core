import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Sources } from 'apps/common';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  imports: [TypegooseModule.forFeature([Sources])],
  controllers: [SourcesController],
  providers: [SourcesService],
})
export class SourcesModule {}
