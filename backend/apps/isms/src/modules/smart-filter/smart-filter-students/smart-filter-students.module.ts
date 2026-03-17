import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, StudentsSmartFilter } from 'apps/common';
import { SmartFilterStudentsService } from './smart-filter-students.service';
import { SmartFilterStudentsController } from './smart-filter-students.controller';
import { SmartFilterStudentsFiltersService } from './filters.service';

@Module({
  imports: [TypegooseModule.forFeature([StudentsSmartFilter, Accounts])],
  controllers: [SmartFilterStudentsController],
  providers: [SmartFilterStudentsService, SmartFilterStudentsFiltersService],
})
export class SmartFilterStudentsModule {}
