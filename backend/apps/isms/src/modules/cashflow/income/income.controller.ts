import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams, QueryDTO } from 'apps/common';
import { IncomeService } from './income.service';
import { Controller, Post, Body, Get, Param, UseInterceptors, Delete, Headers, Query } from '@nestjs/common';
import { CreateIncomeDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Cashflow - Income')
@Controller('cashflow/income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Fetch income` })
  public async fetch(@Query() query: QueryDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.incomeService.fetch(query, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Create a income` })
  public async create(@Body() body: CreateIncomeDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.incomeService.create(body, tokenPayload);
  }

  @Get('by-transaction-id/:transactionId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch by transaction oid`,
  })
  public async fetchByTransactionId(@Param('transactionId') transactionId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.incomeService.fetchByTransactionId(transactionId, tokenPayload);
  }

  @Delete(':cashflowId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a cashflow`,
  })
  public async softDelete(@Param('cashflowId') cashflowId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.incomeService.softDelete(cashflowId, tokenPayload);
  }
}
