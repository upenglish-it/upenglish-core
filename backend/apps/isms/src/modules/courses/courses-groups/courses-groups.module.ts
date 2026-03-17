import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { CoursesGroups } from 'apps/common';
import { CoursesGroupsService } from './courses-groups.service';
import { CoursesGroupsController } from './courses-groups.controller';

@Module({
  imports: [TypegooseModule.forFeature([CoursesGroups])],
  controllers: [CoursesGroupsController],
  providers: [CoursesGroupsService],
})
export class CoursesGroupsModule {}
