import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { LanguageService } from './language.service';
import { Controller, Body, Headers, UseInterceptors, Patch } from '@nestjs/common';
import { UpdateLanguageDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Language')
@Controller('language')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  @Patch()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a language`,
  })
  public async update(@Body() body: UpdateLanguageDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.languageService.update(body, tokenPayload);
  }
}
