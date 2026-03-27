import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { SSTTeacherPrompts } from 'apps/common/src/database/mongodb/src/superstudy';
import { TeacherPromptsController } from './teacher-prompts.controller';
import { TeacherPromptsService } from './teacher-prompts.service';

@Module({
  imports: [TypegooseModule.forFeature([SSTTeacherPrompts])],
  controllers: [TeacherPromptsController],
  providers: [TeacherPromptsService],
  exports: [TeacherPromptsService],
})
export class TeacherPromptsModule {}
