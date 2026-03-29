import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { ResponseHandlerService, STATUS_CODE } from 'apps/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    // console.log('getResponse', exception.getResponse());

    if (status === 404) {
      const resp = exception.getResponse();
      const exceptionMessage = typeof resp === 'object' && resp['message'] ? resp['message'] : 'API not found';
      response.status(status).json(
        ResponseHandlerService({
          success: false,
          httpCode: exception.getStatus(),
          statusCode: STATUS_CODE.NOT_FOUND,
          message: exceptionMessage,
        }),
      );
    }

    if (status === 400) {
      // Bad request (possible error from class validator/joi)
      let classValidatorMessage: string = typeof exception.getResponse()['message'] === 'object' ? exception.getResponse()['message'][0] : exception.getResponse()['message'];

      if (classValidatorMessage.includes(':') && classValidatorMessage.split(':').length > 0) {
        const splittedMessages = classValidatorMessage.split(':');
        let singleError = splittedMessages[0].trim();
        if (splittedMessages.shift().split(',').length > 0) {
          const subSplittedMessages = splittedMessages.shift().split(',');
          singleError = subSplittedMessages[0].trim();
        }
        classValidatorMessage = singleError.replace(/['"]+/g, '');
      }

      response.status(200).json(
        ResponseHandlerService({
          success: false,
          httpCode: exception.getStatus(),
          statusCode: STATUS_CODE.REQUEST_DENIED,
          message: classValidatorMessage,
          errorDetails: exception.getResponse(),
        }),
      );
    }
  }
}
