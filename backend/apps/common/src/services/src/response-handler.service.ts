import { IResponseHandlerParams } from '../../interfaces/src/response-handler.interface';

export const ResponseHandlerService = (params: IResponseHandlerParams): IResponseHandlerParams => {
  if (params.errorDetails) {
    console.log('errorDetails: ', params.errorDetails);
  }
  return {
    timeRequested: new Date().toUTCString(),
    environment: process.env?.NODE_ENV ? process.env.NODE_ENV : null,
    ...params,
  };
};
