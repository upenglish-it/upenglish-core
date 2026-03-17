import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Courses } from 'apps/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';

@Module({
  imports: [TypegooseModule.forFeature([Courses])],
  controllers: [CoursesController],
  providers: [CoursesService],
})
export class CoursesModule {}
