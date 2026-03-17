import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateSourceDTO, UpdateSourceDTO } from './dto';
import { IResponseHandlerParams, ResponseHandlerService, STATUS_CODE, IAuthTokenPayload, Sources } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class SourcesService {
  constructor(@InjectModel(Sources) private readonly sources: ReturnModelType<typeof Sources>) {}

  public async create(body: CreateSourceDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const source = await this.sources.create({
        value: body.value,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Source was created',
        data: source,
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

  public async updateById(sourceId: string, body: UpdateSourceDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const source = await this.sources.findOneAndUpdate(
        {
          _id: sourceId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          value: body.value,
        },
        { new: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Source was updated',
        data: source,
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

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const sources = await this.sources
        .aggregate([
          {
            $match: {
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(sources)) {
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
        data: sources,
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

  public async fetchById(sourceId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const sources = await this.sources.findOne({
        _id: sourceId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(sources)) {
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
        data: sources,
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

  public async softDelete(sourceId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.sources.updateOne(
        {
          _id: sourceId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Source has been deleted',
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
