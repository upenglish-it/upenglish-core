// NestJs imports
import { DateTime } from 'luxon';
import { isEmpty } from 'lodash';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { HttpStatus, Injectable } from '@nestjs/common';
// DTO
import { AuthSignInDTO, AuthSignInSSODTO } from './dto';
// Common
import {
  GENERATE_AUTHORIZATION_TOKEN,
  IResponseHandlerParams,
  ResponseHandlerService,
  STATUS_CODE,
  Accounts,
} from 'apps/common';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Accounts)
    private readonly accountsModel: ReturnModelType<typeof Accounts>,
  ) {}

  // ─── Shared ISMS lookup ────────────────────────────────────────────────
  private async findAccountByEmail(email: string) {
    return this.accountsModel
      .findOne({ emailAddresses: { $in: [email.toLowerCase().trim()] } })
      .lean();
  }

  private buildTokenAndProfile(account: any, request: Request) {
    const authorizationToken = GENERATE_AUTHORIZATION_TOKEN({
      payload: {
        accountId: account._id,
        queryIds: {},
      },
      device: {
        source: (request as any).headers?.['user-agent'] ?? '',
      },
      interval: {
        expireAt: DateTime.now().plus({ hours: 24 }).toISO(),
      },
    });

    return {
      authorizationToken,
      userId: account._id,
      email: account.emailAddresses?.[0] ?? '',
      displayName: `${account.firstName ?? ''} ${account.lastName ?? ''}`.trim(),
      role: account.role,
      active: account.active,
      profilePhoto: account.profilePhoto ?? null,
    };
  }

  // ─── Dev: email-password sign in ──────────────────────────────────────
  /**
   * Email-only sign in — LOCAL DEVELOPMENT TESTING only.
   * Looks up directly against ISMS Accounts by email.
   */
  public async signIn(body: AuthSignInDTO, request: Request): Promise<IResponseHandlerParams> {
    try {
      if (body.provider === 'email-password') {
        const account = await this.findAccountByEmail(body.emailAddress);

        if (isEmpty(account)) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.NOT_FOUND,
            statusCode: STATUS_CODE.NOT_FOUND,
            message: 'Incorrect email address or password',
          });
        }

        if (!account.active) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.UNAUTHORIZED,
            message: 'Unable to access your account. Please contact the admin.',
          });
        }

        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.HAS_DATA,
          data: this.buildTokenAndProfile(account, request),
        });
      }

      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.NOT_IMPLEMENTED,
        message: `Provider '${body.provider}' is not supported here. Use the SSO endpoint.`,
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  // ─── Production: SSO sign in ──────────────────────────────────────────
  /**
   * Called after Google/Microsoft OAuth resolves the user's email.
   * Checks ISMS Accounts — if account exists and is active, issues a JWT.
   * If NOT found, returns 404 so the frontend shows "not registered" state.
   * Never creates a new account.
   */
  public async signInViaSSOEmail(body: AuthSignInSSODTO, request: Request): Promise<IResponseHandlerParams> {
    try {
      const account = await this.findAccountByEmail(body.emailAddress);

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Your account is not registered in the system. Please contact your administrator.',
        });
      }

      if (!account.active) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: 'Unable to access your account. Please contact the admin.',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: this.buildTokenAndProfile(account, request),
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  // ─── Dev: generate token by email ────────────────────────────────────
  /**
   * Generate token by email — LOCAL DEVELOPMENT TESTING only.
   */
  public async generateTokenByEmail(emailAddress: string, request: Request): Promise<IResponseHandlerParams> {
    try {
      console.log('[Auth] generateTokenByEmail:', emailAddress);

      const account = await this.findAccountByEmail(emailAddress);

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Account not found for the given email address',
        });
      }

      if (!account.active) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          message: 'Unable to access your account. Please contact the admin.',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: this.buildTokenAndProfile(account, request),
      });
    } catch (error) {
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }
}
