import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { Body, Controller, Get, Headers, Post, UseInterceptors } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { ActionLeaveRequestDTO, RequestLeaveDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Leaves')
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Get('staff')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch leaves of staffs` })
  public async fetchRequest(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.leavesService.fetchRequest(tokenPayload);
  }

  @Get('staff/request')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch leaves by staff` })
  public async fetchStaffRequest(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.leavesService.fetchStaffRequest(tokenPayload);
  }

  @Post('staff/request')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Staff request leaves` })
  public async addStaffRequest(@Body() body: RequestLeaveDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.leavesService.addStaffRequest(body, tokenPayload);
  }

  @Post('action')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Approve/Reject staff leaves` })
  public async action(@Body() body: ActionLeaveRequestDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.leavesService.action(body, tokenPayload);
  }

  // @Get('by-id/:id')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Fetch shift by id`,
  // })
  // public async fetchById(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.leavesService.fetchById(id, tokenPayload);
  // }

  // @Patch(':id')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Update a schedule by id`,
  // })
  // public async update(@Param('id') id: string, @Body() body: UpdateShiftDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.leavesService.updateById(id, body, tokenPayload);
  // }

  // @Patch(':id')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Update a branch`,
  // })
  // public async update(@Param('id') id: string, @Body() body: CreateBranchDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.branchesService.update(id, body, tokenPayload);
  // }

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
