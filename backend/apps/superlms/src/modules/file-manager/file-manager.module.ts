import { Module } from '@nestjs/common';
import { FileManagerController } from './file-manager.controller';
import { FileManagerService } from './file-manager.service';
import { AWSS3Service } from 'apps/common';

@Module({
  controllers: [FileManagerController],
  providers: [FileManagerService, AWSS3Service],
})
export class FileManagerModule {}
