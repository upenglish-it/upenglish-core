import { Module } from '@nestjs/common';
import { TypegooseModule } from 'nestjs-typegoose';
import { Accounts, Calendars, CalendarsEvents, Integrations } from 'apps/common';
import { MicrosoftCalendarController } from './microsoft/microsoft.controller';
import { MicrosoftCalendarService } from './microsoft/microsoft.service';
import { CalendarsService } from './calendars.service';
import { CalendarsController } from './calendars.controller';

@Module({
  imports: [TypegooseModule.forFeature([Accounts, Integrations, Calendars, CalendarsEvents])],
  controllers: [CalendarsController, MicrosoftCalendarController],
  providers: [CalendarsService, MicrosoftCalendarService],
})
export class CalendarsModule {}
