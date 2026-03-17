import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateBranchDTO, SwitchBranchDTO } from './dto';
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  PropertiesBranches,
  STATUS_CODE,
  IAuthTokenPayload,
  GENERATE_AUTHORIZATION_TOKEN,
  AccountsProperties,
  Accounts,
} from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(PropertiesBranches) private readonly propertiesBranches: ReturnModelType<typeof PropertiesBranches>,
    @InjectModel(AccountsProperties) private readonly accountsProperties: ReturnModelType<typeof AccountsProperties>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>
  ) {}

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const branches = await this.propertiesBranches
        .find({
          properties: tokenPayload.propertyId,
        })
        .sort({
          createdAt: -1,
        });

      if (isEmpty(branches)) {
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
        data: branches,
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

  public async assigned(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      /* account */
      const account = await this.accounts.findOne({ _id: tokenPayload.accountId }, { propertiesBranches: 1 });

      const propertiesBranches = await this.propertiesBranches.find({
        _id: {
          $in: account.propertiesBranches,
        },
      });

      if (isEmpty(propertiesBranches)) {
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
        data: propertiesBranches,
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

  public async create(body: CreateBranchDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdPropertyBranch = await this.propertiesBranches.create({
        name: body.name,
        address: body.address,
        properties: tokenPayload.propertyId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Branch was created successfully',
        data: createdPropertyBranch,
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

  public async update(id: string, body: CreateBranchDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const updatedPropertyBranch = await this.propertiesBranches.findOneAndUpdate(
        {
          _id: id,
          properties: tokenPayload.propertyId,
        },
        {
          name: body.name,
          address: body.address,
        }
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Branch was updated successfully',
        data: updatedPropertyBranch,
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

  public async setPrimary(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.propertiesBranches.updateMany(
        {
          properties: tokenPayload.propertyId,
        },
        {
          primary: false,
        }
      );

      const updatedPropertyBranch = await this.propertiesBranches.findOneAndUpdate(
        {
          _id: id,
          properties: tokenPayload.propertyId,
        },
        {
          primary: true,
        }
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Branch was updated successfully',
        data: updatedPropertyBranch,
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

  public async delete(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      this.propertiesBranches
        .findOneAndUpdate(
          {
            _id: id,
            properties: tokenPayload.propertyId,
          },
          {
            deleted: true,
          }
        )
        .then();
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Branch was deleted',
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

  public async undo(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      this.propertiesBranches
        .findOneAndUpdate(
          {
            _id: id,
            properties: tokenPayload.propertyId,
          },
          {
            deleted: false,
          }
        )
        .then();

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Branch was recovered',
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

  public async switch(body: SwitchBranchDTO, tokenPayload: IAuthTokenPayload, request: Request): Promise<IResponseHandlerParams> {
    try {
      const branchId = body.branchId;

      const composeAuthorizationToken = GENERATE_AUTHORIZATION_TOKEN({
        payload: {
          accountId: tokenPayload.accountId,
          propertyId: tokenPayload.propertyId,
          ...(body?.branchId ? { branchId: branchId } : null),
          queryIds: {
            propertyId: tokenPayload.propertyId,
            ...(body?.branchId ? { branchId: branchId } : null),
          },
        },
        device: {
          source: request.headers['user-agent'],
        },
        interval: {
          expireAt: DateTime.now()
            .plus({
              hours: 24,
            })
            .toISO(),
        },
      });

      /* Check if the account dont have associated properties - 
      /* due to migration complexity, staff need to hit update button in UI */
      // const existingProperties = await this.accountsProperties.find({
      //   accounts: updatedAccount._id,
      //   properties: tokenPayload.propertyId,
      // });
      // if (isEmpty(existingProperties)) {
      /* Save associated property */
      await this.accounts.findOneAndUpdate({ _id: tokenPayload.accountId }, { $set: { selectedBranch: branchId } });
      // }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Branch was switched',
        data: {
          authorizationToken: composeAuthorizationToken,
          ...(body?.branchId ? { selectedBranch: branchId } : null),
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
