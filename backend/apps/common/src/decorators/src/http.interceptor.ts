import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpStatus } from '@nestjs/common';
import { ResponseHandlerService, STATUS_CODE, SameUserAgent, NodeRSADecryptService, IAuthToken } from 'apps/common';
import { isEmpty } from 'lodash';
import { Observable, catchError, throwError, map } from 'rxjs';

export interface Response<T> {
  data: T;
}

@Injectable()
export class HTTPInterceptor implements NestInterceptor {
  public async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const headers = context.switchToHttp().getRequest().headers;

    // console.log('headers', headers['authorization']);
    const authorization = headers['authorization'];

    // console.log(isEmpty(authorization), isEmpty(NodeRSADecryptService(authorization)));
    if (isEmpty(authorization) || isEmpty(NodeRSADecryptService(authorization))) {
      return next.handle().pipe(
        map(() =>
          ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.UNAUTHORIZED,
            statusCode: STATUS_CODE.REQUEST_DENIED,
            message: 'Client request has not been completed because it lacks of valid authorization for the requested resource',
          }),
        ),
      );
      // return ResponseHandlerService({
      //   success: false,
      //   httpCode: HttpStatus.UNAUTHORIZED,
      //   statusCode: STATUS_CODE.REQUEST_DENIED,
      //   message: 'Client request has not been completed because it lacks of valid authorization for the requested resource',
      // });
    }

    // console.log('authorization', authorization);
    const decryptedXAuthToken = NodeRSADecryptService(authorization) as IAuthToken;

    // console.log('xAuthToken', decryptedXAuthToken);

    const userAgent = context.switchToHttp().getRequest()?.useragent?.source;
    // console.log('userAgent', userAgent);
    // console.log('headers ', context.switchToHttp().getRequest().useragent.source);
    // Manage use session here
    // check token is match in the db
    // if match extend the token life to 1day.
    // If expired already, tell the user to continue the session and enter the password to extend the life of session
    // moment('Sat, 12 Mar 2022 10:46:29 GMT').isAfter('Sat, 12 Mar 2022 10:46:25 GMT');
    if (userAgent) {
      const sameUserAgent = SameUserAgent(userAgent, userAgent);

      // console.log('sameUserAgent', sameUserAgent);

      if (sameUserAgent) {
        headers['token-payload'] = decryptedXAuthToken.payload;
        delete headers['authorization'];
      }
      if (!sameUserAgent) {
        // return ResponseHandlerService({
        //   success: false,
        //   httpCode: HttpStatus.UNAUTHORIZED,
        //   message: 'Session has been expired',
        // });

        return next.handle().pipe(
          map(() =>
            ResponseHandlerService({
              success: false,
              httpCode: HttpStatus.UNAUTHORIZED,
              message: 'Session has been expired',
            }),
          ),
        );
      }
    }
    return next.handle();
  }
}
