import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Tags } from 'apps/common';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [TypegooseModule.forFeature([Tags])],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}
