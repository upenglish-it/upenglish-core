import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { SmartFilterStudentsService } from './smart-filter-students.service';
import { Controller, Post, Body, UseInterceptors, Headers, Get, Param, Patch, Query } from '@nestjs/common';
import { CreateSmartFilterDTO, UpdateSmartFilterDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Smart Filter - Students')
@Controller('smart-filter/students')
export class SmartFilterStudentsController {
  constructor(private readonly smartFilterStudentsService: SmartFilterStudentsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch all smart filters`,
  })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.smartFilterStudentsService.fetch(tokenPayload);
  }

  @Get(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch smart filter by id`,
  })
  public async fetchById(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.smartFilterStudentsService.fetchById(id, tokenPayload);
  }

  @Get('filter/result')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch filter results by ids`,
  })
  public async fetchFilterResult(@Query('ids') ids: Array<string>, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.smartFilterStudentsService.fetchFilterResult(ids, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create smart filter`,
  })
  public async create(@Body() body: CreateSmartFilterDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.smartFilterStudentsService.create(body, tokenPayload);
  }

  @Patch(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update smart filter`,
  })
  public async update(@Param('id') id: string, @Body() body: UpdateSmartFilterDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.smartFilterStudentsService.update(id, body, tokenPayload);
  }

  @Patch(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete smart filter`,
  })
  public async delete(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.smartFilterStudentsService.delete(id, tokenPayload);
  }
}
