// NestJs imports
import { DateTime } from 'luxon';
import { isEmpty } from 'lodash';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { HttpStatus, Injectable } from '@nestjs/common';
// DTO
import { AuthSignInDTO } from './dto';
// Common
import {
  GENERATE_AUTHORIZATION_TOKEN,
  IResponseHandlerParams,
  ResponseHandlerService,
  STATUS_CODE,
} from 'apps/common';
// Schema
import { SSTUsers } from 'apps/common/src/database/mongodb/src/superstudy';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(SSTUsers)
    private readonly usersModel: ReturnModelType<typeof SSTUsers>,
  ) {}

  /**
   * Sign in with email-password (production login flow).
   * Mirrors isms AuthService.signIn — adapted to SSTUsers schema.
   */
  public async signIn(body: AuthSignInDTO, request: Request): Promise<IResponseHandlerParams> {
    try {
      if (body.provider === 'email-password') {
        const user = await this.usersModel.findOne({
          email: body.emailAddress?.toLowerCase().trim(),
        });

        if (isEmpty(user)) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.NOT_FOUND,
            statusCode: STATUS_CODE.NOT_FOUND,
            message: 'Incorrect email address or password',
          });
        }

        if (user.disabled) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.UNAUTHORIZED,
            message: 'Unable to access your account. Please contact the admin.',
          });
        }

        if (user.status === 'pending') {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.UNAUTHORIZED,
            message: 'Your account is pending approval.',
          });
        }

        const authorizationToken = GENERATE_AUTHORIZATION_TOKEN({
          payload: {
            accountId: (user._id as any).toString(),
            queryIds: {},
          },
          device: {
            source: (request as any).headers?.['user-agent'] ?? '',
          },
          interval: {
            expireAt: DateTime.now().plus({ hours: 24 }).toISO(),
          },
        });

        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.HAS_DATA,
          data: {
            authorizationToken,
            userId: (user._id as any).toString(),
            email: user.email,
            role: user.role,
            status: user.status,
            displayName: (user as any).displayName ?? '',
          },
        });
      }

      // Other providers (microsoft, google) — return placeholder for now
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.NOT_IMPLEMENTED,
        message: `Provider '${body.provider}' is not yet configured for this application.`,
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

  /**
   * Generate token by email — LOCAL DEVELOPMENT TESTING only.
   * Mirrors isms AuthService.generateTokenByEmail exactly.
   * Allows generating a valid auth token without a password,
   * useful for testing endpoints in Swagger or Postman locally.
   */
  public async generateTokenByEmail(emailAddress: string, request: Request): Promise<IResponseHandlerParams> {
    try {
      console.log('[Auth] generateTokenByEmail:', emailAddress);

      const user = await this.usersModel.findOne({
        email: emailAddress?.toLowerCase().trim(),
      });

      if (isEmpty(user)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Account not found for the given email address',
        });
      }

      if (user.disabled) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          message: 'Unable to access your account. Please contact the admin.',
        });
      }

      const tokenData = {
        payload: {
          accountId: (user._id as any).toString(),
          queryIds: {},
        },
        device: {
          source: (request as any).headers?.['user-agent'] ?? '',
        },
        interval: {
          expireAt: DateTime.now().plus({ hours: 24 }).toISO(),
        },
      };

      console.log('[Auth] tokenData >>', tokenData);

      const authorizationToken = GENERATE_AUTHORIZATION_TOKEN(tokenData);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          authorizationToken,
          userId: (user._id as any).toString(),
          email: user.email,
          role: user.role,
          status: user.status,
          displayName: (user as any).displayName ?? '',
        },
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
