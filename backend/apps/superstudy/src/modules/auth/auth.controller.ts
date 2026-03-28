// DTO
import { AuthSignInDTO, AuthSignInSSODTO } from './dto';
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

  /**
   * Email-password sign in — LOCAL DEVELOPMENT TESTING only.
   * In production, users authenticate via Google/Microsoft SSO.
   */
  @Post('signin')
  @ApiOperation({ summary: 'Login with email (dev testing only) — checks ISMS Accounts' })
  public async signIn(@Body() body: AuthSignInDTO, @Req() request: Request): Promise<IResponseHandlerParams> {
    return this.authService.signIn(body, request);
  }

  /**
   * SSO sign in — PRODUCTION flow.
   * Called after Google/Microsoft OAuth resolves the user's email.
   * Checks ISMS Accounts. If not found, returns 404 (no auto-creation).
   */
  @Post('signin-sso')
  @ApiOperation({ summary: 'Sign in via SSO email — checks ISMS, no auto-account creation' })
  public async signInViaSSOEmail(@Body() body: AuthSignInSSODTO, @Req() request: Request): Promise<IResponseHandlerParams> {
    return this.authService.signInViaSSOEmail(body, request);
  }

  /**
   * Generate token by email — LOCAL DEVELOPMENT TESTING only.
   */
  @Get('generate-token')
  @ApiOperation({ summary: 'Generate token by email (dev testing only)' })
  @ApiResponse({ description: 'Returns authorizationToken and user info for the given emailAddress' })
  public async generateTokenByEmail(
    @Query('emailAddress') email: string,
    @Req() request: Request,
  ): Promise<IResponseHandlerParams> {
    return this.authService.generateTokenByEmail(email, request);
  }
}
