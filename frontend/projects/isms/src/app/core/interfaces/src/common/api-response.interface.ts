export interface IAPIResponse {
  timeRequested: string;
  success: boolean;
  httpCode: number;
  statusCode: string;
  message: string;
  data: any;
}
