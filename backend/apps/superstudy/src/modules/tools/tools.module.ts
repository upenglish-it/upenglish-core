import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTools } from 'apps/common/src/database/mongodb/src/superstudy';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTTools])],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
