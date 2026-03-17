// DTO's
import { AuthSignInDTO } from './dto';
// Modules
import { AuthService } from './auth.service';
// Commons
import { IResponseHandlerParams } from 'apps/common';
// NestJs imports
import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Post('signin')
  // @ApiOperation({
  //   summary: `Sign In account`,
  // })
  // public async signIn(@Body() body: SocialLoginDTO, @Req() request: Request): Promise<IResponseHandlerParams> {
  //   return this.authService.signIn(body, request);
  // }

  @Get('social-authorization')
  @ApiOperation({
    summary: `Manage social authorization`,
  })
  @ApiResponse({ description: 'test' })
  public async manageSocial(@Query() query: any, @Req() request: Request): Promise<IResponseHandlerParams> {
    return this.authService.socialAuthorization(query, request);
  }

  @Post('signin')
  @ApiOperation({
    summary: `Login account`,
  })
  public async signIn(@Body() body: AuthSignInDTO, @Req() request: Request): Promise<IResponseHandlerParams> {
    return this.authService.signIn(body, request);
  }

  // @Post('register/email')
  // @ApiOperation({
  //   summary: `Create an account using email`,
  // })
  // public async create(@Body() body: CreateAccountDTO): Promise<IResponseHandlerParams> {
  //   return await this.accountsService.create(body);
  // }

  // @Post('register/email/verify')
  // @ApiOperation({
  //   summary: `Verify registered email address`,
  // })
  // public async verifyEmailAddress(@Body() body: VerifyRegisteredEmailAddressAccountDTO): Promise<IResponseHandlerParams> {
  //   return await this.accountsService.verifyRegisteredEmailAddress(body);
  // }

  // @Get(':accountId')
  // @ApiOperation({
  //   summary: `Fetch account`,
  // })
  // public async fetchAccount(@Param('accountId') accountId: string): Promise<IResponseHandlerParams> {
  //   return await this.accountsService.fetchAccount(accountId);
  // }

  @Get('generate-token')
  @ApiOperation({
    summary: `Fetch token`,
  })
  public async generateTokenByEmail(@Query('emailAddress') email: string, @Req() request: Request): Promise<IResponseHandlerParams> {
    return await this.authService.generateTokenByEmail(email, request);
  }
}
