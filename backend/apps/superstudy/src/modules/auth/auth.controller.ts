// DTO
import { AuthSignInDTO } from './dto';
// Service
import { AuthService } from './auth.service';
// Common
import { IResponseHandlerParams } from 'apps/common';
// NestJs imports
import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiBearerAuth(process.env.AUTHORIZATION_KEY)
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signin')
  @ApiOperation({
    summary: 'Login account (email-password)',
  })
  public async signIn(@Body() body: AuthSignInDTO, @Req() request: Request): Promise<IResponseHandlerParams> {
    return this.authService.signIn(body, request);
  }

  @Get('generate-token')
  @ApiOperation({
    summary: 'Generate token by email — LOCAL DEVELOPMENT TESTING only',
  })
  @ApiResponse({ description: 'Returns authorizationToken and user info for the given emailAddress' })
  public async generateTokenByEmail(
    @Query('emailAddress') email: string,
    @Req() request: Request,
  ): Promise<IResponseHandlerParams> {
    return this.authService.generateTokenByEmail(email, request);
  }
}
