import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { Body, Controller, Get, Headers, Param, Patch, Post, UseInterceptors } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDTO, UpdateScheduleDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Schedules')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch schedules`,
  })
  public async fetch(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesService.fetch(tokenPayload);
  }

  @Get('by-id/:id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch schedule by id`,
  })
  public async fetchById(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesService.fetchById(id, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a schedule`,
  })
  public async create(@Body() body: CreateScheduleDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesService.create(body, tokenPayload);
  }

  @Patch(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Update a schedule by id`,
  })
  public async update(@Param('id') id: string, @Body() body: UpdateScheduleDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesService.updateById(id, body, tokenPayload);
  }

  // @Patch(':id/set-primary')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Update a branch`,
  // })
  // public async setPrimary(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.branchesService.setPrimary(id, tokenPayload);
  // }

  // @Post('switch')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Switch branch`,
  // })
  // public async switch(@Body() body: SwitchBranchDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload, @Req() request: Request): Promise<IResponseHandlerParams> {
  //   return await this.branchesService.switch(body, tokenPayload, request);
  // }

  // @Delete(':id')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Delete a branch`,
  // })
  // public async delete(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.branchesService.delete(id, tokenPayload);
  // }

  // @Post(':id/undo')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Delete a branch`,
  // })
  // public async undo(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.branchesService.undo(id, tokenPayload);
  // }
}
