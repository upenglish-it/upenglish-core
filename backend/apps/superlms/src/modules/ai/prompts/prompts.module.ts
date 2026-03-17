import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { TypegooseModule } from 'nestjs-typegoose';
import { IELTSPrompts } from 'apps/common';

@Module({
  imports: [TypegooseModule.forFeature([IELTSPrompts])],
  controllers: [PromptsController],
  providers: [PromptsService],
})
export class PromptsModule {}
