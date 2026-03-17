import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { TagsService } from './tags.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers, Query } from '@nestjs/common';
import { CreateTagDTO, GetTagsDTO, UpdateTagDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Templates - Tags')
@Controller('templates/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch tags`,
  })
  public async fetch(@Query() query: GetTagsDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tagsService.fetch(query, tokenPayload);
  }

  @Get(':tagId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch tag by id` })
  public async fetchById(@Param('tagId') tagId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tagsService.fetchById(tagId, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a tag`,
  })
  public async createDay(@Body() body: CreateTagDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tagsService.create(body, tokenPayload);
  }

  @Patch(':tagId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a tag`,
  })
  public async updateById(@Param('tagId') tagId: string, @Body() body: UpdateTagDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tagsService.updateById(tagId, body, tokenPayload);
  }

  @Delete(':tagId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a tag`,
  })
  public async softDelete(@Param('tagId') tagId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.tagsService.softDelete(tagId, tokenPayload);
  }
}
