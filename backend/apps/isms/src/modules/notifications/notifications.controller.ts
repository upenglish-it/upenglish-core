import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { NotificationsService } from './notifications.service';
import { Controller, Body, Headers, UseInterceptors, Patch, Get } from '@nestjs/common';
import { UpdateGCMDTO, UpdateNotificationDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch all notification`,
  })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.notificationsService.fetch(tokenPayload);
  }

  @Patch()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a notification`,
  })
  public async update(@Body() body: UpdateNotificationDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.notificationsService.update(body, tokenPayload);
  }

  @Patch('gcm')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update GCM token`,
  })
  public async updateGCM(@Body() body: UpdateGCMDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.notificationsService.updateGCM(body, tokenPayload);
  }
}
