import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { CalendarsService } from './calendars.service';
import { Controller, UseInterceptors, Headers, Get, Param, Delete, Post, Body, Patch } from '@nestjs/common';
import { CreateUpdateCalendarsEventDTO } from './microsoft/dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Calendars')
@Controller('calendars')
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get('integrated')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all integrated calendars` })
  public async integrated(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.calendarsService.integrated(tokenPayload);
  }

  @Delete('unlink/:integrationId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Unlink integrated calendar` })
  public async unlink(@Param('integrationId') integrationId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.calendarsService.unlink(integrationId, tokenPayload);
  }

  @Get('integrated/:integrationId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all integrated calendars` })
  public async fetchIntegratedById(@Param('integrationId') integrationId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.calendarsService.fetchIntegratedById(integrationId, tokenPayload);
  }

  @Get('events')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all calendars events` })
  public async calendarEvents(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.calendarsService.calendarEvents(tokenPayload);
  }

  @Post('events')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create calendar event` })
  public async createCalendarEvent(@Body() body: CreateUpdateCalendarsEventDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.calendarsService.createCalendarEvent(body, tokenPayload);
  }

  @Patch('events/:calendarEventId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update calendar event` })
  public async updateCalendarEvent(
    @Param('calendarEventId') calendarEventId: string,
    @Body() body: CreateUpdateCalendarsEventDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.calendarsService.updateCalendarEvent(calendarEventId, body, tokenPayload);
  }

  @Delete('events/:calendarEventId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Delete calendar event` })
  public async deleteCalendarEvent(@Param('calendarEventId') calendarEventId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.calendarsService.deleteCalendarEvent(calendarEventId, tokenPayload);
  }
}
