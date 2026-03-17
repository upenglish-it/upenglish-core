import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateAnnouncementDTO, UpdateAnnouncementDTO } from './dto';
import { IResponseHandlerParams, ResponseHandlerService, Announcements, STATUS_CODE, IAuthTokenPayload, StudentsTuitionAttendance } from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectModel(Announcements) private readonly announcements: ReturnModelType<typeof Announcements>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
  ) {}

  public async create(body: CreateAnnouncementDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.find({
        classes: body.classId,
      });

      const announcement = await this.announcements.create({
        title: body.title,
        message: body.message,
        participants: studentsTuitionAttendance.map((v) => v.student),
        classes: body.classId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Announcement was created successfully',
        data: announcement,
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

  public async update(announcementsId: string, body: UpdateAnnouncementDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.find({
        classes: body.classId,
      });
      const announcement = await this.announcements.findOneAndUpdate(
        {
          _id: announcementsId,
          properties: tokenPayload.queryIds.propertyId,
        },
        {
          title: body.title,
          message: body.message,
          classes: body.classId,
          participants: studentsTuitionAttendance.map((v) => v.student),
        },
        { new: true },
      );
      if (isEmpty(announcement)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Announcement was updated successfully',
        data: announcement,
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

  public async verify(announcementsId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const announcement = await this.announcements.findOneAndUpdate(
        {
          _id: announcementsId,
          properties: tokenPayload.queryIds.propertyId,
        },
        { verified: true },
        { new: true },
      );
      if (isEmpty(announcement)) {
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
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Announcement was verified successfully',
        data: announcement,
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
      const announcements = await this.announcements.find({
        // verified: true,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });
      // .populate([
      //   {
      //     path: 'createdBy',
      //     model: Accounts,
      //     select: { _id: 1, firstName: 1, lastName: 1, profilePhoto: 1 },
      //   },
      // ])
      // .sort({ createdAt: -1 });

      if (isEmpty(announcements)) {
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
        data: announcements,
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

  public async fetchById(announcementsId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const announcement = await this.announcements.findOne({
        verified: true,
        _id: announcementsId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        deleted: false,
      });

      if (isEmpty(announcement)) {
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
        data: announcement,
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

  public async fetchByParticipantId(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const announcements = await this.announcements
        .find({
          verified: true,
          participants: { $in: [tokenPayload.accountId] },
          deleted: false,
        })
        .sort({ createdAt: -1 });
      if (isEmpty(announcements)) {
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
        data: announcements,
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

  public async softDelete(announcementsId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.announcements.updateOne(
        {
          _id: announcementsId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        },
        { deleted: true },
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Material has been deleted',
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
