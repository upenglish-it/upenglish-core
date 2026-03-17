import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { ICalendarEventWebhook, MicrosoftCalendarService } from './microsoft.service';
import { Controller, Post, Body, UseInterceptors, Headers, Get, Header, Req, Res, Query } from '@nestjs/common';
import { MicrosoftAuthorizedDTO, MicrosoftCalendarsEventWebhookQueryDTO, MicrosoftSyncAndUnsyncDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Calendar - Microsoft')
@Controller('calendar/microsoft')
export class MicrosoftCalendarController {
  constructor(private readonly microsoftCalendarService: MicrosoftCalendarService) {}

  @Get('generate-redirect-url')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create a redirect url for authentication` })
  public async generateRedirectURL(@Body() body: any, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.microsoftCalendarService.generateRedirectURL(body, tokenPayload);
  }

  @Post('pre-sync')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Initiate calendar pre-sync` })
  public async preSync(@Body() body: MicrosoftAuthorizedDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.microsoftCalendarService.preSync(body, tokenPayload);
  }

  @Post('sync')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Sync calendars and events` })
  public async sync(@Body() body: MicrosoftSyncAndUnsyncDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.microsoftCalendarService.sync(body, tokenPayload);
  }

  @Post('unsync')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Unsync calendars and events` })
  public async unsync(@Body() body: MicrosoftSyncAndUnsyncDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.microsoftCalendarService.unsync(body, tokenPayload);
  }

  @Post('event/webook')
  @Header('content-type', 'text/plain')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Calendar event webhook` })
  public async calendarEventWebhook(@Body() body: ICalendarEventWebhook, @Query() query: MicrosoftCalendarsEventWebhookQueryDTO, @Req() req: Request, @Res() res: Response): Promise<Express.Response> {
    if (req.query['validationToken']) {
      return res.status(200).send(req.query['validationToken']);
    } else {
      // this.calendarWebhookEventCatcherService.eventWebhookCatcher({
      //   resourceState: req.headers['x-goog-resource-state'] as string, // use for google
      //   outlookEventValue: body,
      //   calendarIntegrationId: query.calendarIntegrationId,
      //   calendarIntegrationGroupId: query.calendarIntegrationGroupId,
      //   provider: query.provider,
      // });
      this.microsoftCalendarService.calendarEventWebhook({ ...query, webhook: body });
    }
    return res.status(200).send({ success: true, message: 'Calendar event received' });
  }

  // @Post('event/webhook')
  // @Header('content-type', 'text/plain')
  // @ApiOperation({ summary: `Google calendar event webhook catcher` })
  // public async eventWebhook(@Body() body: CalendarEventWebhookBodyDTO, @Query() query: CalendarEventWebhookQueryDTO, @Req() req: Request, @Res() res: Response): Promise<any> {
  //   if (req.query['validationToken']) {
  //     return res.status(200).send(req.query['validationToken']);
  //   } else {
  //     this.calendarWebhookEventCatcherService.eventWebhookCatcher({
  //       resourceState: req.headers['x-goog-resource-state'] as string, // use for google
  //       outlookEventValue: body,
  //       calendarIntegrationId: query.calendarIntegrationId,
  //       calendarIntegrationGroupId: query.calendarIntegrationGroupId,
  //       provider: query.provider,
  //     });
  //   }

  //   return res.status(200).send('Event received');
  // }

  // @Get('calendars')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Fetch calendars`,
  // })
  // public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.microsoftCalendarService.fetchCalendars(tokenPayload);
  // }

  // @Get(':announcementsId')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({ summary: `Fetch announcement by id` })
  // public async fetchById(@Param('announcementsId') announcementsId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.announcementsService.fetchById(announcementsId, tokenPayload);
  // }

  // @Get('participant/by-id')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({ summary: `Fetch announcement by id` })
  // public async fetchByParticipantId(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.announcementsService.fetchByParticipantId(tokenPayload);
  // }

  // @Post()
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Create a announcements`,
  // })
  // public async create(@Body() body: CreateAnnouncementDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.announcementsService.create(body, tokenPayload);
  // }

  // @Patch(':announcementsId')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Update student information`,
  // })
  // public async update(
  //   @Param('announcementsId') announcementsId: string,
  //   @Body() body: UpdateAnnouncementDTO,
  //   @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  // ): Promise<IResponseHandlerParams> {
  //   return await this.announcementsService.update(announcementsId, body, tokenPayload);
  // }

  // @Delete(':announcementsId')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Delete a announcements`,
  // })
  // public async softDelete(@Param('announcementsId') announcementsId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.announcementsService.softDelete(announcementsId, tokenPayload);
  // }
}
