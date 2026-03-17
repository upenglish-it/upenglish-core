import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateSmartFilterDTO, UpdateSmartFilterDTO } from './dto';
import { IResponseHandlerParams, ResponseHandlerService, STATUS_CODE, IAuthTokenPayload, StudentsSmartFilter } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';
import { SmartFilterStudentsFiltersService } from './filters.service';

@Injectable()
export class SmartFilterStudentsService {
  constructor(
    @InjectModel(StudentsSmartFilter) private readonly studentsSmartFilter: ReturnModelType<typeof StudentsSmartFilter>,
    private readonly smartFilterStudentsFiltersService: SmartFilterStudentsFiltersService,
  ) {}

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const smartFilters = await this.studentsSmartFilter
        .find({
          properties: tokenPayload.propertyId,
          ...(tokenPayload.queryIds.branchId ? { propertiesBranches: tokenPayload.queryIds.branchId } : null),
        })
        .sort({ createdAt: -1 });

      if (isEmpty(smartFilters)) {
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
        data: smartFilters,
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

  public async fetchById(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const smartFilter = await this.studentsSmartFilter.findOne({
        _id: id,
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(smartFilter)) {
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
        data: smartFilter,
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

  public async fetchFilterResult(ids: Array<string>, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const smartFilters = await this.studentsSmartFilter.find({
        _id: { $in: ids },
        properties: tokenPayload.propertyId,
      });

      if (isEmpty(smartFilters)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      let mergedSmartFilters = [];
      smartFilters.forEach((smartFiler) => {
        mergedSmartFilters = [...mergedSmartFilters, ...smartFiler.filters];
      });

      const students = await this.smartFilterStudentsFiltersService.fetchFilterResult(mergedSmartFilters, tokenPayload);

      if (isEmpty(students)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No student(s) found',
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: students,
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

  public async create(body: CreateSmartFilterDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdSmartFilter = await this.studentsSmartFilter.create({
        title: body.title,
        filters: body.filters,
        accounts: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Smart filter was created successfully',
        data: createdSmartFilter,
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

  public async update(id: string, body: UpdateSmartFilterDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const smartFilter = await this.studentsSmartFilter.findOne({
        _id: id,
        properties: tokenPayload.propertyId,
      });
      if (isEmpty(smartFilter)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      /* update smart filter */
      const updatedSmartFilter = await this.studentsSmartFilter.findOneAndUpdate(
        {
          _id: id,
          properties: tokenPayload.propertyId,
        },
        {
          title: body.title,
          filters: body.filters,
        },
        {
          new: true,
        },
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
        data: updatedSmartFilter,
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
      const smartFilter = await this.studentsSmartFilter.findOne({
        _id: id,
        properties: tokenPayload.propertyId,
      });
      if (isEmpty(smartFilter)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      /* delete smart filter */
      await this.studentsSmartFilter.findOneAndDelete({
        _id: id,
        properties: tokenPayload.propertyId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Successfully deleted',
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
