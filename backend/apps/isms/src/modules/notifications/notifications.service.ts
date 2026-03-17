import { HttpStatus, Injectable } from '@nestjs/common';
import { UpdateGCMDTO, UpdateNotificationDTO } from './dto';
import { IResponseHandlerParams, ResponseHandlerService, STATUS_CODE, IAuthTokenPayload, Accounts, Notifications } from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { AccountsService } from '../accounts/accounts.service';
import { isEmpty } from 'lodash';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(Notifications) private readonly notifications: ReturnModelType<typeof Notifications>,
    private readonly accountsService: AccountsService,
  ) {}

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const notifications = await this.notifications
        .find({
          accounts: tokenPayload.accountId,
        })
        .sort({ createdAt: -1 });

      if (isEmpty(notifications)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: notifications,
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

  public async update(body: UpdateNotificationDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      this.accounts
        .findOneAndUpdate(
          {
            _id: tokenPayload.accountId,
          },
          {
            notification: body,
          },
        )
        .then();

      const account = await this.accountsService.accountInfo(tokenPayload.accountId);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Notification was updated successfully',
        data: account,
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

  public async updateGCM(body: UpdateGCMDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      this.accounts
        .findOneAndUpdate(
          {
            _id: tokenPayload.accountId,
          },
          {
            gcmToken: body.token,
          },
        )
        .then();

      const account = await this.accountsService.accountInfo(tokenPayload.accountId);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Notification was updated successfully',
        data: account,
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
