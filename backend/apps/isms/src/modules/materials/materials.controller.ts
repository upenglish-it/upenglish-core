import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { MaterialsService } from './materials.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers } from '@nestjs/common';
import { CreateMaterialDTO, UpdateMaterialDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Materials')
@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch materials`,
  })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.materialsService.fetch(tokenPayload);
  }

  @Get(':materialId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch material by id`,
  })
  public async fetchById(@Param('materialId') materialId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.materialsService.fetchById(materialId, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a material`,
  })
  public async create(@Body() body: CreateMaterialDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.materialsService.create(body, tokenPayload);
  }

  @Patch(':materialId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update material`,
  })
  public async update(@Param('materialId') materialId: string, @Body() body: UpdateMaterialDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.materialsService.update(materialId, body, tokenPayload);
  }

  @Delete(':materialId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a material`,
  })
  public async softDelete(@Param('materialId') materialId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.materialsService.softDelete(materialId, tokenPayload);
  }
}
