import { Controller, HttpCode, HttpStatus, Headers, Get, UseInterceptors, Body, Post, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { HTTPInterceptor } from 'apps/common';
import { JoiPipe } from 'nestjs-joi';
import { PromptsService } from './prompts.service';
import { CreatePromptDTO, UpdateByIdPromptDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Prompts')
@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch all prompts` })
  public async getAll(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.promptsService.getAll(tokenPayload);
  }

  @Get(':promptId')
  @UseInterceptors(HTTPInterceptor)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Fetch a prompt by id` })
  public async getById(
    @Param('promptId') promptId: string,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.promptsService.getById(promptId, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create a prompt` })
  public async create(
    @Body(JoiPipe) body: CreatePromptDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.promptsService.create(body, tokenPayload);
  }

  @Patch(':promptId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a prompt by id` })
  public async updateById(
    @Param('promptId') promptId: string,
    @Body(JoiPipe) body: UpdateByIdPromptDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.promptsService.updateById(promptId, body, tokenPayload);
  }
}
