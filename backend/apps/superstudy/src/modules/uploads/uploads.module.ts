import { Module } from '@nestjs/common';
import { AWSS3Service } from 'apps/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, AWSS3Service],
  exports: [UploadsService],
})
export class UploadsModule {}
