import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IResponseHandlerParams } from 'apps/common';
import { PropertiesService } from './properties.service';
import { Controller, Post, Body, Req, Get, Param } from '@nestjs/common';
import { CreatePropertyDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @ApiOperation({
    summary: `Create an organization`,
  })
  public async create(@Body() body: CreatePropertyDTO): Promise<IResponseHandlerParams> {
    return await this.propertiesService.create(body);
  }
}
