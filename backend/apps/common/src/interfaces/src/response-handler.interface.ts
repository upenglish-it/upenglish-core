export interface IResponseHandlerParams {
  timeRequested?: string;
  environment?: string;
  success?: boolean;
  httpCode?: number;
  statusCode?: string;
  message?: string;
  data?: any;
  errorDetails?: any;
}
