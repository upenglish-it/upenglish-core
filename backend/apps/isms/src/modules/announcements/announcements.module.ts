import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Announcements, StudentsTuitionAttendance } from 'apps/common';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';

@Module({
  imports: [TypegooseModule.forFeature([Announcements, StudentsTuitionAttendance])],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
