import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Materials } from 'apps/common';
import { MaterialsService } from './materials.service';
import { MaterialsController } from './materials.controller';

@Module({
  imports: [TypegooseModule.forFeature([Materials])],
  controllers: [MaterialsController],
  providers: [MaterialsService],
})
export class MaterialModule {}
