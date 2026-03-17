import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HTTPInterceptor, IAuthTokenPayload, IResponseHandlerParams, QueryDTO } from 'apps/common';
import { ExpensesService } from './expeses.service';
import { Controller, Post, Body, Req, Get, Param, UseInterceptors, Delete, Headers, Query } from '@nestjs/common';
import { CreateExpenseDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Cashflow - Expenses')
@Controller('cashflow/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch expense`,
  })
  public async fetch(@Query() query: QueryDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.expensesService.fetch(query, tokenPayload);
  }

  @Post()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Create a expense`,
  })
  public async create(@Body() body: CreateExpenseDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.expensesService.create(body, tokenPayload);
  }

  @Delete(':cashflowId')
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Delete a expense`,
  })
  public async softDelete(@Param('cashflowId') cashflowId: string, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.expensesService.softDelete(cashflowId, tokenPayload);
  }
}
