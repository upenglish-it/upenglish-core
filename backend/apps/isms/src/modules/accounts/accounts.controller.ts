import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IResponseHandlerParams, HTTPInterceptor, IAuthTokenPayload } from 'apps/common';
import { AccountsService } from './accounts.service';
import { Controller, Post, Body, Get, UseInterceptors, Headers, Patch } from '@nestjs/common';
import { CreateAccountDTO, UpdateAccountDTO } from './dto';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('customer')
  @ApiOperation({
    summary: `Create a customer account`,
  })
  public async create(@Body() body: CreateAccountDTO): Promise<IResponseHandlerParams> {
    return await this.accountsService.createCustomer(body);
  }

  @Get()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({
    summary: `Fetch account information`,
  })
  public async fetchAccount(@Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.accountsService.fetchInformation(tokenPayload);
  }

  @Patch()
  @UseInterceptors(HTTPInterceptor)
  @ApiOperation({ summary: `Update account information` })
  public async updateById(@Body() body: UpdateAccountDTO, @Headers('token-payload') tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    return await this.accountsService.updateById(body, tokenPayload);
  }
}
