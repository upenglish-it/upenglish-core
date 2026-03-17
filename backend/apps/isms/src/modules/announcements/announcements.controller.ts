import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { AnnouncementsService } from './announcements.service';
import { Controller, Post, Body, Req, Get, Param, UseInterceptors, Delete, Patch, Headers } from '@nestjs/common';
import { CreateAnnouncementDTO, UpdateAnnouncementDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch announcements`,
  })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.announcementsService.fetch(tokenPayload);
  }

  @Get(':announcementsId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch announcement by id` })
  public async fetchById(@Param('announcementsId') announcementsId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.announcementsService.fetchById(announcementsId, tokenPayload);
  }

  @Get('participant/by-id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch announcement by id` })
  public async fetchByParticipantId(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.announcementsService.fetchByParticipantId(tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a announcements`,
  })
  public async create(@Body() body: CreateAnnouncementDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.announcementsService.create(body, tokenPayload);
  }

  @Patch(':announcementsId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update student information`,
  })
  public async update(
    @Param('announcementsId') announcementsId: string,
    @Body() body: UpdateAnnouncementDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.announcementsService.update(announcementsId, body, tokenPayload);
  }

  @Patch(':announcementsId/verify')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Verify announcement`,
  })
  public async verify(@Param('announcementsId') announcementsId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.announcementsService.verify(announcementsId, tokenPayload);
  }

  @Delete(':announcementsId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a announcements`,
  })
  public async softDelete(@Param('announcementsId') announcementsId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.announcementsService.softDelete(announcementsId, tokenPayload);
  }
}
