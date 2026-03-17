import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { ClassesService } from './classes.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers } from '@nestjs/common';
import { CreateClassTimeDTO, UpdateClassTimeDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Classes Time')
@Controller('classes-time')
export class ClassesTimeController {
  constructor(private readonly coursesService: ClassesService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch time`,
  })
  public async fetchDays(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.fetchTime(tokenPayload);
  }

  @Get(':timeId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch time by id` })
  public async fetchTimeById(@Param('timeId') timeId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.fetchTimeById(timeId, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a time`,
  })
  public async createDay(@Body() body: CreateClassTimeDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.createTime(body, tokenPayload);
  }

  @Patch(':dayId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a class time`,
  })
  public async updateById(@Param('dayId') dayId: string, @Body() body: UpdateClassTimeDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.updateTimeById(dayId, body, tokenPayload);
  }

  @Delete(':timeId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a time`,
  })
  public async softDelete(@Param('timeId') timeId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.softDeleteTime(timeId, tokenPayload);
  }
}
