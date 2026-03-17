import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { SourcesService } from './sources.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers } from '@nestjs/common';
import { CreateSourceDTO, UpdateSourceDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Templates - Sources')
@Controller('templates/sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch sources`,
  })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.sourcesService.fetch(tokenPayload);
  }

  @Get(':sourceId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch source by id` })
  public async fetchById(@Param('sourceId') sourceId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.sourcesService.fetchById(sourceId, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a source`,
  })
  public async createDay(@Body() body: CreateSourceDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.sourcesService.create(body, tokenPayload);
  }

  @Patch(':sourceId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a source`,
  })
  public async updateById(@Param('sourceId') sourceId: string, @Body() body: UpdateSourceDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.sourcesService.updateById(sourceId, body, tokenPayload);
  }

  @Delete(':sourceId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a source`,
  })
  public async softDelete(@Param('sourceId') sourceId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.sourcesService.softDelete(sourceId, tokenPayload);
  }
}
