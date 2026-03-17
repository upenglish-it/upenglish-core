import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateCourseDTO, UpdateCourseDTO } from './dto';
import { IAuthTokenPayload, IResponseHandlerParams, ResponseHandlerService, Courses, STATUS_CODE } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class CoursesService {
  constructor(@InjectModel(Courses) private readonly courses: ReturnModelType<typeof Courses>) {}

  public async create(body: CreateCourseDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const name = body.name.trim();
      const createdCourse = await this.courses.create({
        name: name,
        price: body.price,
        material: body.material,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        hourlyMonthlyPrice: body.hourlyMonthlyPrice,
        hourlyPackagePrice: body.hourlyPackagePrice,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Course was created',
        data: createdCourse,
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
      console.log('tokenPayload', tokenPayload);
      const createdCourses = await this.courses
        .aggregate([
          {
            $match: {
              // properties: tokenPayload.propertyId,
              propertiesBranches: tokenPayload.branchId,
              deleted: false,
            },
          },
          {
            $lookup: {
              from: 'materials',
              foreignField: '_id',
              localField: 'material',
              as: 'material',
            },
          },
          {
            $unwind: {
              path: '$material',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'classes',
              localField: '_id',
              foreignField: 'courses',
              as: 'class',
              pipeline: [
                {
                  $project: {
                    _id: 0,
                    id: '$_id',
                    name: 1,
                  },
                },
              ],
            },
          },
        ])
        .sort({ createdAt: -1 });

      if (isEmpty(createdCourses)) {
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
        data: createdCourses,
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

  public async fetchById(courseId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const courses = await this.courses.findOne({
        _id: courseId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(courses)) {
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
        data: courses,
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

  public async updateById(courseId: string, body: UpdateCourseDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const createdClassTime = await this.courses.findOneAndUpdate(
        {
          _id: courseId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        {
          name: body.name,
          price: body.price,
          material: body.material,
          hourlyMonthlyPrice: body.hourlyMonthlyPrice,
          hourlyPackagePrice: body.hourlyPackagePrice,
        },
        { new: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Course was updated',
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
      await this.courses.updateOne(
        {
          _id: courseId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Course has been deleted',
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

  // when we update the classes status to finished, then all the `students-tuition-attendance` status need to updated too
}
