import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { StaffsService } from './staffs.service';
import { Controller, Post, Body, Get, UseInterceptors, Param, Patch, Headers, Query, Delete } from '@nestjs/common';
import {
  CreateStaffDTO,
  CreateStaffSalaryPackageDTO,
  FetchStaffSalaryPackageDTO,
  FetchStaffsDTO,
  RemoveStaffSalaryByDateDTO,
  SetStaffSalaryAdvancementDTO,
  SetStaffSalaryByDateDTO,
  SetStaffSalaryPackageDTO,
  UpdateSalaryIncreaseDTO,
  UpdateStaffEmploymentInformationDTO,
  UpdateStaffEmploymentSettingsDTO,
  UpdateStaffPersonalInformationDTO,
  UpdateStaffSalaryPackageDTO,
} from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Staffs')
@Controller('staffs')
export class StaffsController {
  constructor(private readonly staffsService: StaffsService) {}

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create a staff` })
  public async create(@Body() body: CreateStaffDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.create(body, tokenPayload);
  }

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all staffs` })
  public async fetch(@Query() query: FetchStaffsDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetch(query, tokenPayload);
  }

  @Get(':id')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch staff by id` })
  public async fetchById(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetchById(id, tokenPayload);
  }

  @Patch(':id/personal-information')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update staff personal information` })
  public async updatePersonalInformation(
    @Param('id') id: string,
    @Body() body: UpdateStaffPersonalInformationDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.updatePersonalInformation(id, body, tokenPayload);
  }

  @Patch(':id/employment-settings')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update staff employment settings` })
  public async updateEmploymentSettings(
    @Param('id') id: string,
    @Body() body: UpdateStaffEmploymentSettingsDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.updateEmploymentSettings(id, body, tokenPayload);
  }

  @Get(':id/employment-settings')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch staff employment settings` })
  public async fetchEmploymentSettings(@Param('id') id: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetchEmploymentSettings(id, tokenPayload);
  }

  @Get(':staffId/salary')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch staff salary by date` })
  public async fetchSalaryByDate(@Param('staffId') staffId: string, @Query('date') date: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetchSalaryByDate(staffId, date, tokenPayload);
  }

  @Get(':staffId/salary-history')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch staff salary history` })
  public async fetchSalaryHistoryById(@Param('staffId') staffId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetchSalaryHistoryById(staffId, tokenPayload);
  }

  @Post(':staffId/salary/by-date')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Set staff salary by date`,
  })
  public async setSalaryByDate(@Param('staffId') staffId: string, @Body() body: SetStaffSalaryByDateDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.setSalaryByDate(staffId, body, tokenPayload);
  }

  @Delete(':staffId/salary/by-date')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Remove staff salary by date` })
  public async removeSalaryByDate(
    @Param('staffId') staffId: string,
    @Body() body: RemoveStaffSalaryByDateDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.removeSalaryByDate(staffId, body, tokenPayload);
  }

  @Get(':staffId/salary/packages')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch salary packages` })
  public async fetchSalaryPackages(@Param('staffId') staffId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetchSalaryPackages(staffId, tokenPayload);
  }

  @Get(':staffId/salary/package')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch assigned salary packages` })
  public async fetchSalaryPackageById(
    @Param('staffId') staffId: string,
    @Query() query: FetchStaffSalaryPackageDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetchSalaryPackageById(staffId, query, tokenPayload);
  }

  @Post(':staffId/salary/create-package')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create salary package` })
  public async createSalaryPackage(
    @Param('staffId') staffId: string,
    @Body() body: CreateStaffSalaryPackageDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.createSalaryPackage(staffId, body, tokenPayload);
  }

  @Patch(':staffId/salary/update-package/:salaryPackageId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update salary package` })
  public async updateSalaryPackage(
    @Param('staffId') staffId: string,
    @Param('salaryPackageId') salaryPackageId: string,
    @Body() body: UpdateStaffSalaryPackageDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.updateSalaryPackage(staffId, salaryPackageId, body, tokenPayload);
  }

  @Post(':staffId/salary/assign-package')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Assign salary package` })
  public async assignSalaryPackage(
    @Param('staffId') staffId: string,
    @Body() body: SetStaffSalaryPackageDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.assignSalaryPackage(staffId, body, tokenPayload);
  }

  @Get(':staffId/salary/assigned-package')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch assigned salary packages` })
  public async assignedSalaryPackage(@Param('staffId') staffId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.assignedSalaryPackage(staffId, tokenPayload);
  }

  @Patch(':staffId/employee-information/update')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update employee information` })
  public async updateEmploymentInformation(
    @Param('staffId') staffId: string,
    @Body() body: UpdateStaffEmploymentInformationDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.updateEmploymentInformation(staffId, body, tokenPayload);
  }

  @Patch(':staffId/salary-increase')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update salary increase` })
  public async updateSalaryIncrease(
    @Param('staffId') staffId: string,
    @Body() body: UpdateSalaryIncreaseDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.updateSalaryIncrease(staffId, body, tokenPayload);
  }

  @Get(':staffId/salary/fetch-advancement')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch salary advancement` })
  public async fetchSalaryAdvancement(@Param('staffId') staffId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.staffsService.fetchSalaryAdvancement(staffId, tokenPayload);
  }

  @Post(':staffId/salary/set-advancement')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Set salary advancement` })
  public async setSalaryAdvancement(
    @Param('staffId') staffId: string,
    @Body() body: SetStaffSalaryAdvancementDTO,
    @Headers('token-payload') tokenPayload: IAuthTokenPayload,
  ): Promise<IResponseHandlerParams> {
    return await this.staffsService.setSalaryAdvancement(staffId, body, tokenPayload);
  }

  // @Get('salary/:staffId')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Set a staff salary`,
  // })
  // public async fetchSalary(@Param('staffId') staffId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.staffsService.fetchSalary(staffId, tokenPayload);
  // }

  // // @Post('salary')
  // // @UseInterceptors(HTTPInterceptor)
  // // @ApiOperation({
  // //   summary: `Set a staff salary`,
  // // })
  // // public async setSalary(@Body() body: CreateStaffSalaryDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  // //   return await this.staffsService.setSalary(body, tokenPayload);
  // // }

  // @Patch('salary')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Set a staff salary`,
  // })
  // public async update(@Body() body: SetStaffSalaryDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.staffsService.setSalary(body, tokenPayload);
  // }

  // @Post('salary/save-payment')
  // @UseInterceptors(HTTPInterceptor)
  // @ApiOperation({
  //   summary: `Save payment`,
  // })
  // public async savePayment(@Body() body: SavePaymentSalaryDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   return await this.staffsService.savePayment(body, tokenPayload);
  // }
}
