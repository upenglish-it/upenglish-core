import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IResponseHandlerParams } from 'apps/common';
import { ProfOfPaymentService } from './pop.service';
import { Controller, Get, Param } from '@nestjs/common';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Proof of Payment')
@Controller('pop')
export class ProfOfPaymentController {
  constructor(private readonly profOfPaymentService: ProfOfPaymentService) {}

  @Get('student/:urlCode')
  @ApiOperation({ summary: `Fetch student receipt by id` })
  public async fetchStudentReceipt(@Param('urlCode') urlCode: string): Promise<IResponseHandlerParams> {
    return await this.profOfPaymentService.fetchStudentReceipt(urlCode);
  }

  @Get('staff/:urlCode')
  @ApiOperation({ summary: `Fetch staff payslip by id` })
  public async fetchStaffPayslip(@Param('urlCode') urlCode: string): Promise<IResponseHandlerParams> {
    return await this.profOfPaymentService.fetchStaffPayslip(urlCode);
  }

  @Get('cashflow/:transactionId')
  @ApiOperation({
    summary: `Fetch cashflow receipt`,
  })
  public async fetchExpenseByTransactionId(@Param('transactionId') transactionId: string): Promise<IResponseHandlerParams> {
    return await this.profOfPaymentService.fetchCashflowByTransactionId(transactionId);
  }
}
