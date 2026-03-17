import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateCourseGroupDTO, UpdateCourseGroupDTO } from './dto';
import { IResponseHandlerParams, ResponseHandlerService, CoursesGroups, STATUS_CODE, IAuthTokenPayload } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class CoursesGroupsService {
  constructor(@InjectModel(CoursesGroups) private readonly coursesGroups: ReturnModelType<typeof CoursesGroups>) {}

  public async create(body: CreateCourseGroupDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdCourseGroup = await this.coursesGroups.create({
        name: body.name,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        courses: body.courses,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Group was created',
        data: createdCourseGroup,
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
      const createdCoursesGroups = await this.coursesGroups
        .aggregate([
          {
            $match: {
              properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
          },
          {
            $lookup: {
              from: 'courses',
              localField: 'courses',
              foreignField: '_id',
              as: 'courses',
            },
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(createdCoursesGroups)) {
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
        data: createdCoursesGroups,
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

  public async fetchById(courseGroupId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const courseGroup = await this.coursesGroups.findOne({ _id: courseGroupId, properties: tokenPayload.propertyId, propertiesBranches: tokenPayload.branchId, deleted: false });

      if (isEmpty(courseGroup)) {
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
        data: courseGroup,
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

  public async updateById(courseGroupId: string, body: UpdateCourseGroupDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdClassTime = await this.coursesGroups.findOneAndUpdate(
        {
          _id: courseGroupId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          name: body.name,
          courses: body.courses,
        },
        { new: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Course group was updated',
        data: createdClassTime,
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

  public async softDelete(courseId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.coursesGroups.updateOne(
        {
          _id: courseId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Group has been deleted',
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
