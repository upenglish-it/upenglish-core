import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTAnonymousFeedback } from 'apps/common/src/database/mongodb/src/superstudy';
import { AnonymousFeedbackController } from './anonymous-feedback.controller';
import { AnonymousFeedbackService } from './anonymous-feedback.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTAnonymousFeedback])],
  controllers: [AnonymousFeedbackController],
  providers: [AnonymousFeedbackService],
  exports: [AnonymousFeedbackService],
})
export class AnonymousFeedbackModule {}
