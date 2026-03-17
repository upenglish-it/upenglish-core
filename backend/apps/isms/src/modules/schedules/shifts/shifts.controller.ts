import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseInterceptors } from '@nestjs/common';
import { SchedulesShiftsService } from './shifts.service';
import { CreateShiftDTO, ManageTeacherLessonDetailsDTO, ManageTeacherShiftDTO, UpdateShiftDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Schedules Shifts')
@Controller('schedules/shifts')
export class SchedulesShiftsController {
  constructor(private readonly schedulesShiftsService: SchedulesShiftsService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch shifts`,
  })
  public async fetchAccount(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.fetch(tokenPayload);
  }

  @Get('by-id/:id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch shift by id` })
  public async fetchById(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.fetchById(id, tokenPayload);
  }

  @Get('teacher/assigned')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Assigned shift in teacher` })
  public async fetchAssignedShiftToTeacher(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.fetchAssignedShiftToTeacher(tokenPayload);
  }

  @Post('teacher/manage')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Manage shift in teacher` })
  public async teacherManageShift(
    @Body() body: ManageTeacherShiftDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.teacherManageShift(body, tokenPayload);
  }

  @Post('teacher/manage/lesson-details')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Manage lesson details in teacher` })
  public async teacherManageLessonDetails(
    @Body() body: ManageTeacherLessonDetailsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.teacherManageLessonDetails(body, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create a shift` })
  public async create(@Body() body: CreateShiftDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.create(body, tokenPayload);
  }

  @Patch(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update a schedule by id` })
  public async update(
    @Param('id') id: string,
    @Body() body: UpdateShiftDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload
  ): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.updateById(id, body, tokenPayload);
  }

  @Get('staff')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch shift by id` })
  public async fetchByStaff(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.fetchByStaff(tokenPayload);
  }

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

  @Delete(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a shift`,
  })
  public async deleteById(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.schedulesShiftsService.deleteById(id, tokenPayload);
  }

  // @Post(':id/undo')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Delete a branch`,
  // })
  // public async undo(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.branchesService.undo(id, tokenPayload);
  // }
}
