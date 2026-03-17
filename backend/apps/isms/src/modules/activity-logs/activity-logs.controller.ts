import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { ActivityLogsService } from './activity-logs.service';
import { Controller, Get, UseInterceptors, Headers } from '@nestjs/common';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Activity Logs')
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch activity Logs` })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.activityLogsService.fetch(tokenPayload);
  }
}
