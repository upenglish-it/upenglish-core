import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTToolSubmissions } from 'apps/common/src/database/mongodb/src/superstudy';
import { ToolSubmissionsService } from './tool-submissions.service';
import { ToolSubmissionsController } from './tool-submissions.controller';

@Module({
  imports: [TypegooseModule.forFeature([SSTToolSubmissions])],
  controllers: [ToolSubmissionsController],
  providers: [ToolSubmissionsService],
  exports: [ToolSubmissionsService],
})
export class ToolSubmissionsModule {}
