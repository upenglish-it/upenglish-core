// Lodash
import { isEmpty } from 'lodash';
// Typegoose
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
// NestJs imports
import { HttpStatus, Injectable } from '@nestjs/common';
// DTO
import { CreateShiftDTO, ManageTeacherLessonDetailsDTO, ManageTeacherShiftDTO, UpdateShiftDTO } from './dto';
// Commons
import {
  IResponseHandlerParams,
  ResponseHandlerService,
  STATUS_CODE,
  IAuthTokenPayload,
  SchedulesShifts,
  Accounts,
  StudentsTuitionAttendance,
} from 'apps/common';

@Injectable()
export class SchedulesShiftsService {
  constructor(
    @InjectModel(SchedulesShifts) private readonly schedulesShifts: ReturnModelType<typeof SchedulesShifts>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>
  ) {}

  public async fetch(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedulesShifts = await this.schedulesShifts
        .aggregate([
          {
            $match: {
              properties: tokenPayload.propertyId,
            },
          },

          /* classes */
          {
            $lookup: {
              from: 'classes',
              localField: 'classes',
              foreignField: '_id',
              as: 'classes',
            },
          },
          {
            $unwind: {
              path: '$classes',
              preserveNullAndEmptyArrays: true,
            },
          },

          /* caretaker */
          {
            $lookup: {
              from: 'accounts',
              localField: 'careTaker',
              foreignField: '_id',
              as: 'careTaker',
            },
          },
          {
            $unwind: {
              path: '$careTaker',
              preserveNullAndEmptyArrays: true,
            },
          },

          /* homework checker */
          {
            $lookup: {
              from: 'accounts',
              localField: 'homeworkChecker',
              foreignField: '_id',
              as: 'homeworkChecker',
            },
          },
          {
            $unwind: {
              path: '$homeworkChecker',
              preserveNullAndEmptyArrays: true,
            },
          },
        ])
        .sort({
          createdAt: -1,
        });

      if (isEmpty(schedulesShifts)) {
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
        data: schedulesShifts,
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
      console.log('id', id);
      const schedule = await this.schedulesShifts.aggregate([
        {
          $match: {
            _id: id,
            properties: tokenPayload.propertyId,
            // propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classes',
            foreignField: '_id',
            as: 'classes',
          },
        },
        {
          $unwind: {
            path: '$classes',
            preserveNullAndEmptyArrays: true,
          },
        },
        // {
        //   $lookup: {
        //     from: 'schedules',
        //     localField: 'schedules',
        //     foreignField: '_id',
        //     as: 'schedules',
        //   },
        // },
        // { $unwind: '$schedules' },
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     localField: 'staff',
        //     foreignField: '_id',
        //     as: 'staff',
        //   },
        // },
        // { $unwind: '$staff' },
        {
          $lookup: {
            from: 'accounts',
            localField: 'careTaker',
            foreignField: '_id',
            as: 'careTaker',
          },
        },
        {
          $unwind: {
            path: '$careTaker',
            preserveNullAndEmptyArrays: true,
          },
        },

        /* homework checker */
        {
          $lookup: {
            from: 'accounts',
            localField: 'homeworkChecker',
            foreignField: '_id',
            as: 'homeworkChecker',
          },
        },
        {
          $unwind: {
            path: '$homeworkChecker',
            preserveNullAndEmptyArrays: true,
          },
        },

        /* staffs */
        // {
        //   $addFields: {
        //     staffIds: {
        //       $map: {
        //         input: '$staffs',
        //         in: '$$this.id',
        //       },
        //     },
        //   },
        // },
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     let: {
        //       ids: '$staffIds',
        //     },
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: {
        //             $in: ['$_id', '$$ids'],
        //           },
        //         },
        //       },
        //       {
        //         $project: {
        //           firstName: 1,
        //           lastName: 1,
        //           profilePhoto: 1,
        //         },
        //       },

        //       // schedules
        //       // {
        //       //   $lookup: {
        //       //     from: 'leaves',
        //       //     localField: '_id',
        //       //     foreignField: 'staff',
        //       //     pipeline: [
        //       //       {
        //       //         $project: {
        //       //           notes: 1,
        //       //           type: 1,
        //       //           dates:1
        //       //         },
        //       //       },
        //       //     ],
        //       //     as: 'leaves',
        //       //   },
        //       // },
        //       // {
        //       //   $unwind: '$leaves',
        //       // },
        //     ],
        //     as: 'staffs',
        //   },
        // },
      ]);

      if (isEmpty(schedule)) {
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
        data: schedule[0],
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

  public async fetchAssignedShiftToTeacher(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const shifts = await this.schedulesShifts.aggregate([
        {
          $match: {
            // staffs: { $elemMatch: { id: tokenPayload.accountId } },
            'staffs.id': tokenPayload.accountId,
            // properties: tokenPayload.propertyId,
            // propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classes',
            foreignField: '_id',
            as: 'classes',
          },
        },
        {
          $unwind: {
            path: '$classes',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'schedules',
            localField: 'schedules',
            foreignField: '_id',
            as: 'schedules',
          },
        },
        {
          $unwind: {
            path: '$schedules',
            preserveNullAndEmptyArrays: true,
          },
        },
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     localField: 'staff',
        //     foreignField: '_id',
        //     as: 'staff',
        //   },
        // },
        // { $unwind: '$staff' },
        {
          $lookup: {
            from: 'accounts',
            localField: 'careTaker',
            foreignField: '_id',
            as: 'careTaker',
          },
        },
        {
          $unwind: {
            path: '$careTaker',
            preserveNullAndEmptyArrays: true,
          },
        },

        /* staffs */
        // {
        //   $addFields: {
        //     staffIds: {
        //       $map: {
        //         input: '$staffs',
        //         in: '$$this.id',
        //       },
        //     },
        //   },
        // },
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     let: {
        //       ids: '$staffIds',
        //     },
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: {
        //             $in: ['$_id', '$$ids'],
        //           },
        //         },
        //       },
        //       {
        //         $project: {
        //           firstName: 1,
        //           lastName: 1,
        //           profilePhoto: 1,
        //         },
        //       },

        //       // schedules
        //       // {
        //       //   $lookup: {
        //       //     from: 'leaves',
        //       //     localField: '_id',
        //       //     foreignField: 'staff',
        //       //     pipeline: [
        //       //       {
        //       //         $project: {
        //       //           notes: 1,
        //       //           type: 1,
        //       //           dates:1
        //       //         },
        //       //       },
        //       //     ],
        //       //     as: 'leaves',
        //       //   },
        //       // },
        //       // {
        //       //   $unwind: '$leaves',
        //       // },
        //     ],
        //     as: 'staffs',
        //   },
        // },
      ]);

      if (isEmpty(shifts)) {
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
        data: shifts,
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

  public async teacherManageShift(body: ManageTeacherShiftDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const account = await this.accounts.findOne({ _id: tokenPayload.accountId });
      const schedulesShifts = await this.schedulesShifts.findOneAndUpdate(
        { _id: body.shiftId, properties: tokenPayload.propertyId },
        {
          $push: {
            notes: {
              $each: [
                {
                  date: body.date,
                  accountId: tokenPayload.accountId,
                  fullName: `${account.firstName} ${account.lastName}`.trim(),
                  notes: body.notes,
                },
              ],
              $position: 0,
            },
          },
        },
        { new: true }
      );

      ////
      // const schedulesShift = await this.schedulesShifts.findOne({
      //   _id: body.shiftId,
      //   properties: tokenPayload.propertyId,
      // });

      // let schedulesShifts = null;
      // if (schedulesShift?.lessonDetails.find((ld) => ld.date === body.date)) {
      //   schedulesShifts = await this.schedulesShifts.findOneAndUpdate(
      //     {
      //       _id: body.shiftId,
      //       properties: tokenPayload.propertyId,
      //       'notes.date': body.date,
      //     },
      //     {
      //       $set: {
      //         'notes.$.notes': body.notes,
      //       },
      //     },
      //     { new: true },
      //   );
      // } else {
      //   schedulesShifts = await this.schedulesShifts.findOneAndUpdate(
      //     {
      //       _id: body.shiftId,
      //       properties: tokenPayload.propertyId,
      //     },
      //     {
      //       $addToSet: {
      //         notes: {
      //           date: body.date,
      //           notes: body.notes,
      //         },
      //       },
      //     },
      //     { new: true },
      //   );
      // }
      ///

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
        data: schedulesShifts,
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

  public async teacherManageLessonDetails(body: ManageTeacherLessonDetailsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedulesShift = await this.schedulesShifts.findOne({
        _id: body.shiftId,
        properties: tokenPayload.propertyId,
      });

      let schedulesShifts = null;
      if (schedulesShift?.lessonDetails.find((ld) => ld.date === body.date)) {
        schedulesShifts = await this.schedulesShifts.findOneAndUpdate(
          {
            _id: body.shiftId,
            properties: tokenPayload.propertyId,
            'lessonDetails.date': body.date,
          },
          {
            $set: {
              'lessonDetails.$.lessonDetails': body.lessonDetails,
            },
          },
          { new: true }
        );
      } else {
        schedulesShifts = await this.schedulesShifts.findOneAndUpdate(
          {
            _id: body.shiftId,
            properties: tokenPayload.propertyId,
          },
          {
            $addToSet: {
              lessonDetails: {
                date: body.date,
                lessonDetails: body.lessonDetails,
              },
            },
          },
          { new: true }
        );
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
        data: schedulesShifts,
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

  public async create(body: CreateShiftDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedulesShift = await this.schedulesShifts.create({
        title: body.title,
        type: body.type,
        staffs: body.staffs,
        careTaker: body.careTakerId,
        classes: body.classId,
        startDate: body.startDate,
        room: body.room,
        time: body.time,
        schedule: body.schedule,
        homeworkChecker: body.homeworkCheckerId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
        status: body.status,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
        data: schedulesShift,
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

  public async updateById(id: string, body: UpdateShiftDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedulesShifts = await this.schedulesShifts.findOneAndUpdate(
        { _id: id, properties: tokenPayload.propertyId },
        {
          type: body.type,
          title: body.title,
          staffs: body.staffs,
          careTaker: body.careTakerId,
          classes: body.classId,
          startDate: body.startDate,
          room: body.room,
          time: body.time,
          schedule: body.schedule,
          homeworkChecker: body.homeworkCheckerId,
          status: body.status,
        },
        { new: true }
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
        data: schedulesShifts,
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

  public async fetchByStaff(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedules = await this.schedulesShifts.aggregate([
        {
          $match: {
            staff: tokenPayload.accountId,
            properties: tokenPayload.propertyId,
            // propertiesBranches: tokenPayload.branchId,
            deleted: false,
          },
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classes',
            foreignField: '_id',
            as: 'classes',
          },
        },
        { $unwind: '$classes' },
        {
          $lookup: {
            from: 'schedules',
            localField: 'schedules',
            foreignField: '_id',
            as: 'schedules',
          },
        },
        { $unwind: '$schedules' },
        // {
        //   $lookup: {
        //     from: 'accounts',
        //     localField: 'staff',
        //     foreignField: '_id',
        //     as: 'staff',
        //   },
        // },
        // { $unwind: '$staff' },
        {
          $lookup: {
            from: 'accounts',
            localField: 'careTaker',
            foreignField: '_id',
            as: 'careTaker',
          },
        },
        { $unwind: '$careTaker' },
      ]);

      if (isEmpty(schedules)) {
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
        data: schedules,
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

  public async deleteById(id: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      // const schedulesShift = await this.schedulesShifts.findOne({ _id: id });
      await this.schedulesShifts.deleteOne({ _id: id });
      await this.studentsTuitionAttendance.deleteMany({ schedulesShift: id });

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
