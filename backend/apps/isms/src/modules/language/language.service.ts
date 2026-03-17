import { HttpStatus, Injectable } from '@nestjs/common';
import { UpdateLanguageDTO } from './dto';
import { IResponseHandlerParams, ResponseHandlerService, STATUS_CODE, IAuthTokenPayload, Accounts } from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class LanguageService {
  constructor(@InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>, private readonly accountsService: AccountsService) {}

  public async update(body: UpdateLanguageDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      this.accounts
        .findOneAndUpdate(
          {
            _id: tokenPayload.accountId,
          },
          {
            language: body.language,
          },
        )
        .then();

      const account = await this.accountsService.accountInfo(tokenPayload.accountId);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Language was updated successfully',
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
