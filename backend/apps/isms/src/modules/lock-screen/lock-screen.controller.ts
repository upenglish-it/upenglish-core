import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { LockScreenService } from './lock-screen.service';
import { Controller, Body, Headers, UseInterceptors, Patch } from '@nestjs/common';
import { UpdateLockScreenDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Lock Screen')
@Controller('lock-screen')
export class LockScreenController {
  constructor(private readonly lockScreenService: LockScreenService) {}

  @Patch()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a lock screen`,
  })
  public async update(@Body() body: UpdateLockScreenDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.lockScreenService.update(body, tokenPayload);
  }
}
