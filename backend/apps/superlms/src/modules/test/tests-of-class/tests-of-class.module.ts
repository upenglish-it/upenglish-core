import { Module } from '@nestjs/common';
import { TestsOfClassController } from './tests-of-class.controller';
import { TestsOfClassService } from './tests-of-class.service';
import { TypegooseModule } from 'nestjs-typegoose';
import {
  Accounts,
  Classes,
  Courses,
  IELTSTasks,
  IELTSTestsOfClass,
  IELTSTestsOfClassPeriods,
  IELTSTestsOfClassPeriodsSections,
  IELTSTestsOfClassPeriodsSectionsTests,
  IELTSTestsRedflags,
  IELTSTestsAnnouncements,
  SchedulesShifts,
  StudentsTuitionAttendance,
  IELTSTestsOfClassPeriodsSectionsTestsStudent,
} from 'apps/common';

@Module({
  imports: [
    TypegooseModule.forFeature([
      Classes,
      Courses,
      Accounts,
      IELTSTasks,
      SchedulesShifts,
      IELTSTestsOfClass,
      IELTSTestsRedflags,
      IELTSTestsAnnouncements,
      IELTSTestsOfClassPeriods,
      StudentsTuitionAttendance,
      IELTSTestsOfClassPeriodsSections,
      IELTSTestsOfClassPeriodsSectionsTests,
      IELTSTestsOfClassPeriodsSectionsTestsStudent,
    ]),
  ],
  controllers: [TestsOfClassController],
  providers: [TestsOfClassService],
})
export class TestsOfClassModule {}
