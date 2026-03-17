import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams } from 'apps/common';
import { DashboardAdminService } from './admin.service';
import { Controller, Headers, UseInterceptors, Get } from '@nestjs/common';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Admin - Dashboard')
@Controller('dashboard/admin')
export class DashboardAdminController {
  constructor(private readonly dashboardAdminService: DashboardAdminService) {}

  @Get('statistics')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all annual employment` })
  public async fetchStatistics(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.dashboardAdminService.fetchStatistics(tokenPayload);
  }

  @Get('birthdays-by-month')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all birthday employees by month` })
  public async fetchBirthdaysByMonth(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.dashboardAdminService.fetchBirthdaysByMonth(tokenPayload);
  }

  @Get('employee-anniversary')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all employee anniversary` })
  public async fetchEmployeeAnniversary(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.dashboardAdminService.fetchEmployeeAnniversary(tokenPayload);
  }

  @Get('salary-increase')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch all salary increase` })
  public async salaryIncrease(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.dashboardAdminService.salaryIncrease(tokenPayload);
  }
}
