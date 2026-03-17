import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { ClassesService } from './classes.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Patch, Headers } from '@nestjs/common';
import { CreateClassDayDTO, UpdateClassDayDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Classes Days')
@Controller('classes-days')
export class ClassesDaysController {
  constructor(private readonly coursesService: ClassesService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch days`,
  })
  public async fetchDays(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.fetchDays(tokenPayload);
  }

  @Get(':dayId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch day by id` })
  public async fetchDayById(@Param('dayId') dayId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.fetchDayById(dayId, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a day`,
  })
  public async createDay(@Body() body: CreateClassDayDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.createDay(body, tokenPayload);
  }

  @Patch(':dayId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a class day`,
  })
  public async updateById(@Param('dayId') dayId: string, @Body() body: UpdateClassDayDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.updateDayById(dayId, body, tokenPayload);
  }

  @Delete(':dayId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a day`,
  })
  public async softDelete(@Param('dayId') dayId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.coursesService.softDeleteDay(dayId, tokenPayload);
  }
}
