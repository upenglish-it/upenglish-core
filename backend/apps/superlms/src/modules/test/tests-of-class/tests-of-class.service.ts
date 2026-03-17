// NestJs imports
import { isEmpty } from 'lodash';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { HttpStatus, Injectable } from '@nestjs/common';
// DTO's
import {
  AddPeriodDTO,
  AddSectionDTO,
  UpdateStatusDTO,
  GetTestOfClassDTO,
  UpdatePeriodNameDTO,
  UpdateSectionNameDTO,
  UpdateDescriptionDTO,
  GetStudentTestDetailsDTO,
} from './dto';
import { AddTestDTO } from './dto/src/periods-sections-tests.dto';
import { AddRedflagDTO, GetRedflagsDTO } from './dto/src/red-flags.dto';
import { AddAnnouncementDTO, GetAnnouncementByIdDTO } from './dto/src/announcements.dto';
// Commons
import {
  Accounts,
  Classes,
  Courses,
  IELTSTasks,
  STATUS_CODE,
  SchedulesShifts,
  IAuthTokenPayload,
  IELTSTestsOfClass,
  IELTSTestsRedflags,
  IResponseHandlerParams,
  ResponseHandlerService,
  IELTSTestsOfClassPeriods,
  StudentsTuitionAttendance,
  IELTSTestsOfClassPeriodsCN,
  StudentsTuitionAttendanceCN,
  IELTSTestsOfClassPeriodsSections,
  IELTSTestsOfClassPeriodsSectionsCN,
  IELTSTestsOfClassPeriodsSectionsTests,
  IELTSTestsOfClassPeriodsSectionsTestsCN,
  IELTSTestsOfClassPeriodsSectionsTestsStudentCN,
  IELTSTestsOfClassPeriodsSectionsTestsStudent,
} from 'apps/common';
// Schemas
import { IELTSTestsAnnouncements } from 'apps/common/src/database/mongodb/src/superlms/src/test-of-class/tests-announcement';

@Injectable()
export class TestsOfClassService {
  constructor(
    @InjectModel(SchedulesShifts) private readonly schedulesShifts: ReturnModelType<typeof SchedulesShifts>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>,
    @InjectModel(Classes) private readonly classes: ReturnModelType<typeof Classes>,
    @InjectModel(Courses) private readonly courses: ReturnModelType<typeof Courses>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,

    @InjectModel(IELTSTasks) private readonly tasks: ReturnModelType<typeof IELTSTasks>,
    @InjectModel(IELTSTestsOfClass) private readonly testsOfClass: ReturnModelType<typeof IELTSTestsOfClass>,
    @InjectModel(IELTSTestsRedflags) private readonly testsRedflags: ReturnModelType<typeof IELTSTestsRedflags>,
    @InjectModel(IELTSTestsAnnouncements) private readonly testsAnnouncements: ReturnModelType<typeof IELTSTestsAnnouncements>,
    @InjectModel(IELTSTestsOfClassPeriods) private readonly testsOfClassPeriods: ReturnModelType<typeof IELTSTestsOfClassPeriods>,
    @InjectModel(IELTSTestsOfClassPeriodsSections)
    private readonly testsOfClassPeriodsSections: ReturnModelType<typeof IELTSTestsOfClassPeriodsSections>,
    @InjectModel(IELTSTestsOfClassPeriodsSectionsTests)
    private readonly testsOfClassPeriodsSectionsTests: ReturnModelType<typeof IELTSTestsOfClassPeriodsSectionsTests>,
    @InjectModel(IELTSTestsOfClassPeriodsSectionsTestsStudent)
    private readonly testsOfClassPeriodsSectionsTestsStudent: ReturnModelType<typeof IELTSTestsOfClassPeriodsSectionsTestsStudent>
  ) {}

  public async studentClasses(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const studentsTuitionAttendance = await this.studentsTuitionAttendance.find({ student: tokenPayload.accountId });

      if (isEmpty(studentsTuitionAttendance)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const classIds = studentsTuitionAttendance.map((attendance) => attendance.classes);

      const classes = await this.classes.aggregate([
        { $match: { _id: { $in: classIds } } },
        {
          $lookup: {
            from: 'courses',
            let: {
              courseId: ['$courses'],
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$courseId'],
                  },
                },
              },
            ],
            as: 'course',
          },
        },
        {
          $unwind: {
            path: '$course',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: classes,
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

  public async teacherClassForCourses(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const classes = await this.classes.aggregate([
        {
          $match: {
            // properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          },
        },
        {
          $lookup: {
            from: 'courses',
            let: {
              courseId: ['$courses'],
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$courseId'],
                  },
                },
              },
            ],
            as: 'course',
          },
        },
        {
          $unwind: {
            path: '$course',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);

      if (isEmpty(classes)) {
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
        data: classes,
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

  public async teacherAssignedClassForMyCourses(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedulesShifts = await this.schedulesShifts.find({ 'staffs.id': tokenPayload.accountId });

      const classIds = schedulesShifts.map((shift) => shift.classes);

      if (isEmpty(schedulesShifts)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const classes = await this.classes.aggregate([
        { $match: { _id: { $in: classIds } } },
        // {
        //   $lookup: {
        //     from: 'courses', // collection to join
        //     localField: 'courses', // field in 'course'
        //     foreignField: '_id', // field in 'classs'
        //     as: 'course', // name of the array field in the output
        //   },
        // },
        // {
        //   $unwind: { path: '$course', preserveNullAndEmptyArrays: true },
        // },

        {
          $lookup: {
            from: 'courses',
            let: {
              courseId: ['$courses'],
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$courseId'],
                  },
                },
              },
            ],
            as: 'course',
          },
        },
        {
          $unwind: {
            path: '$course',
            preserveNullAndEmptyArrays: true,
          },
        },

        // {
        //   $lookup: {
        //     from: 'ielts-tests-of-classes',
        //     let: {
        //       ids: ['$class._id'], // id of classs
        //     },
        //     pipeline: [
        //       {
        //         $match: {
        //           $expr: {
        //             $in: ['$class', '$$ids'],
        //           },
        //         },
        //       },
        //     ],
        //     as: 'ieltsTestsOfClass',
        //   },
        // },
        // {
        //   $unwind: {
        //     path: '$ieltsTestsOfClass',
        //     preserveNullAndEmptyArrays: true,
        //   },
        // },
      ]);

      // const classIds = classes.map((cls) => cls.classs);
      // const classs = await this.classs.aggregate([
      //   { $match: { _id: { $in: classIds } } },
      //   // {
      //   //   $lookup: {
      //   //     from: 'ielts-tests-of-classs', // collection to join
      //   //     localField: '_id', // field in 'classs'
      //   //     foreignField: 'class', // field in 'ielts-tests-of-classs'
      //   //     as: 'ieltsTestsOfClass', // name of the array field in the output
      //   //   },
      //   // },

      //   {
      //     $lookup: {
      //       from: 'ielts-tests-of-classs',
      //       let: {
      //         ids: ['$_id'], // id of classs
      //       },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $in: ['$class', '$$ids'],
      //             },
      //           },
      //         },
      //         // {
      //         //   $project: {
      //         //     firstName: 1,
      //         //     lastName: 1,
      //         //   },
      //         // },
      //       ],
      //       as: 'ieltsTestsOfClass',
      //     },
      //   },
      //   {
      //     $unwind: {
      //       path: '$ieltsTestsOfClass',
      //       preserveNullAndEmptyArrays: true,
      //     },
      //   },
      // ]);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: classes,
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

  public async adminCourses(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const classes = await this.classes.aggregate([
        {
          $match: {
            // properties: tokenPayload.propertyId,
            propertiesBranches: tokenPayload.branchId,
          },
        },
        {
          $lookup: {
            from: 'courses',
            let: {
              courseId: ['$courses'],
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$_id', '$$courseId'],
                  },
                },
              },
            ],
            as: 'course',
          },
        },
        {
          $unwind: {
            path: '$course',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: classes,
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

  public async adminClasses(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const classes = await this.classes.find({
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: classes,
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

  public async teacherClasses(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedulesShifts = await this.schedulesShifts.find({ 'staffs.id': tokenPayload.accountId });

      const classIds = schedulesShifts.map((shift) => shift.classes);

      if (isEmpty(schedulesShifts)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      const classes = await this.classes.find({ _id: { $in: classIds } });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: classes,
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

  public async updateDescription(body: UpdateDescriptionDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsOfClass.updateOne({ class: body.classId }, { $set: { description: body.description } });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
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

  public async updateStatus(body: UpdateStatusDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsOfClass.updateOne({ class: body.classId }, { $set: { status: body.status } });
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully updated',
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

  public async addPeriod(body: AddPeriodDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const testsOfClass = await this.testsOfClass.findOne({ class: body.classId });

      console.log('testsOfClass', testsOfClass);

      //--- If the tests of class does not exist, then create a record with section
      if (isEmpty(testsOfClass)) {
        const createdTestsOfClass = await this.testsOfClass.create({
          class: body.classId,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
        await this.testsOfClassPeriods.create({
          name: body.name,
          class: body.classId,
          testsOfClassId: createdTestsOfClass._id,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      }

      if (!isEmpty(testsOfClass)) {
        await this.testsOfClassPeriods.create({
          name: body.name,
          class: body.classId,
          testsOfClassId: testsOfClass._id,
          createdBy: tokenPayload.accountId,
          properties: tokenPayload.propertyId,
          propertiesBranches: tokenPayload.branchId,
        });
      }

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
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

  public async updatePeriodName(periodId: string, body: UpdatePeriodNameDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const testsOfClassPeriod = await this.testsOfClassPeriods.updateOne({ _id: periodId }, { $set: { name: body.name } });

      if (isEmpty(testsOfClassPeriod)) {
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
        message: 'Successfully updated',
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

  public async addSection(periodId: string, body: AddSectionDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const testsOfClassPeriodsSection = await this.testsOfClassPeriods.findOne({
        _id: periodId,
      });

      if (isEmpty(testsOfClassPeriodsSection)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found',
        });
      }

      await this.testsOfClassPeriodsSections.create({
        name: body.name,
        class: body.classId,
        testsOfClassPeriodId: periodId,
        testsOfClassId: body.testOfClassId,
        type: body.type,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
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

  public async deletePeriod(periodId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsOfClassPeriods.deleteOne({ _id: periodId });

      await this.testsOfClassPeriodsSections.deleteMany({
        testsOfClassPeriodId: periodId,
      });

      await this.testsOfClassPeriodsSectionsTests.deleteMany({
        testsOfClassPeriodId: periodId,
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

  public async deleteSection(periodId: string, sectionId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsOfClassPeriodsSections.deleteOne({ _id: sectionId, testsOfClassPeriodId: periodId });

      await this.testsOfClassPeriodsSectionsTests.deleteMany({
        testsOfClassPeriodId: periodId,
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

  public async resetTests(periodId: string, sectionId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsOfClassPeriodsSectionsTestsStudent.updateMany(
        { testsOfClassPeriodSectionId: sectionId },
        {
          $set: {
            'test.variations.$[].parts.$[].items.$[].participantAnswer': '',
            'test.variations.$[].parts.$[].items.$[].reviewerAnswer': '',
            'test.variations.$[].parts.$[].items.$[].score': 0,
          },
          $unset: {
            'test.submittedDate': '',
            'test.variations.$[].parts.$[].items.$[].reviewed': '',
            'test.variations.$[].parts.$[].items.$[].totalNeedToReviewItems': '',
            'test.variations.$[].parts.$[].items.$[].submittedDate': '',
          },
        }
      );

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_UPDATED,
        message: 'Successfully reset',
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

  public async updateSectionName(sectionId: string, body: UpdateSectionNameDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const testsOfClassSection = await this.testsOfClassPeriodsSections.updateOne({ _id: sectionId }, { $set: { name: body.name } });

      if (isEmpty(testsOfClassSection)) {
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
        message: 'Successfully updated',
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

  public async addTest(periodId: string, sectionId: string, body: AddTestDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const test = await this.tasks.findOne({ _id: body.testId });

      await this.testsOfClassPeriodsSectionsTests.create({
        test: test.toJSON(),
        class: body.classId,
        testsOfClassPeriodId: periodId,
        testsOfClassId: body.testOfClassId,
        testsOfClassPeriodSectionId: body.sectionId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
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

  public async deleteTest(periodId: string, sectionId: string, testId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsOfClassPeriodsSectionsTests.deleteOne({
        _id: testId,
        testsOfClassPeriodId: periodId,
        testsOfClassPeriodSectionId: sectionId,
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

  public async getTestOfClass(query: GetTestOfClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const account = await this.accounts.findOne({ _id: tokenPayload.accountId });

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found of account',
        });
      }

      const testsOfClass = await this.testsOfClass.aggregate([
        {
          $match: {
            class: query.classId,
            ...(account.role === 'admin' ? {} : { status: 'published' }),
          },
        },

        {
          $lookup: {
            from: IELTSTestsOfClassPeriodsCN,
            localField: '_id',
            foreignField: 'testsOfClassId',
            as: 'periods',
            pipeline: [
              {
                $sort: { createdAt: -1 },
              },
              {
                $lookup: {
                  from: IELTSTestsOfClassPeriodsSectionsCN,
                  localField: '_id',
                  foreignField: 'testsOfClassPeriodId',
                  as: 'sections',
                  pipeline: [
                    {
                      $lookup: {
                        from: IELTSTestsOfClassPeriodsSectionsTestsCN,
                        localField: '_id',
                        foreignField: 'testsOfClassPeriodSectionId',
                        as: 'tests',
                        pipeline: [
                          {
                            $project: {
                              createdBy: 1,
                              'test.name': 1,
                              'test.type': 1,
                              'test.duration': 1,
                            },
                          },
                        ],
                      },
                    },

                    {
                      $project: {
                        name: 1,
                        type: 1,
                        tests: 1,
                        createdBy: 1,
                      },
                    },
                  ],
                },
              },
              {
                $project: {
                  name: 1,
                  sections: 1,
                  createdBy: 1,
                },
              },
            ],
          },
        },

        // {
        //   $project: {
        //     name: 1,
        //     description: 1,
        //     class: 1,
        //     // periods: 1,
        //     status: 1,
        //   },
        // },
      ]);

      // if (isEmpty(testsOfClass)) {
      //   return ResponseHandlerService({
      //     success: false,
      //     httpCode: HttpStatus.NOT_FOUND,
      //     statusCode: STATUS_CODE.NOT_FOUND,
      //     message: 'No result(s) found of class',
      //   });
      // }

      const students = await this.studentsTuitionAttendance.aggregate([
        { $match: { classes: query.classId } },

        {
          $project: {
            student: 1,
          },
        },

        {
          $lookup: {
            from: 'accounts',
            localField: 'student',
            foreignField: '_id',
            as: 'account',
          },
        },
        {
          $unwind: {
            path: '$account',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'ielts-tests-of-class-periods-sections-tests-student',
            localField: 'account._id',
            foreignField: 'studentId',
            as: 'tests',
            pipeline: [
              {
                $match: {
                  teacherReviewed: false,
                  'test.submittedDate': { $exists: true, $ne: null },
                  'test.variations.parts.items.reviewed': false,
                },
              },
            ],
          },
        },
        {
          $project: {
            'account._id': 1,
            'account.firstName': 1,
            'account.lastName': 1,
            'account.profilePhoto': 1,
            pendingReviews: {
              $size: '$tests',
            },
          },
        },
      ]);

      const staffs = await this.schedulesShifts.aggregate([
        { $match: { classes: query.classId, type: 'class-work', deleted: false } },

        {
          $lookup: {
            from: 'accounts',
            localField: 'careTaker',
            foreignField: '_id',
            as: 'careTaker',
            pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
          },
        },
        { $unwind: { path: '$careTaker', preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: 'accounts',
            localField: 'homeworkChecker',
            foreignField: '_id',
            as: 'homeworkChecker',
            pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
          },
        },
        { $unwind: { path: '$homeworkChecker', preserveNullAndEmptyArrays: true } },

        {
          $lookup: {
            from: 'accounts',
            localField: 'staffs.id',
            foreignField: '_id',
            as: 'teachers',
            pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
          },
        },

        {
          $project: {
            time: 1,
            schedule: 1,
            startDate: 1,
            room: 1,
            careTaker: 1,
            homeworkChecker: 1,
            teachers: 1,
          },
        },
      ]);

      const classInfo = await this.classes.findOne({ _id: query.classId }, { name: 1, courses: 1 });
      const courseInfo = await this.courses.findOne({ _id: classInfo.courses }, { name: 1 });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          students: students,
          class: classInfo,
          course: courseInfo,
          test: testsOfClass.length ? testsOfClass[0] : null,
          scheduleAndStaff: staffs[0], // Make sure that the schedule is tied up to one 'ongoing' class only
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

  // public async getTestOfClass(query: GetTestOfClassDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
  //   try {
  //     const students = await this.studentsTuitionAttendance.aggregate([
  //       { $match: { classes: query.classId } },

  //       {
  //         $project: {
  //           student: 1,
  //         },
  //       },

  //       {
  //         $lookup: {
  //           from: 'accounts',
  //           localField: 'student',
  //           foreignField: '_id',
  //           as: 'account',
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: '$account',
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },
  //       {
  //         $project: {
  //           'account._id': 1,
  //           'account.firstName': 1,
  //           'account.lastName': 1,
  //           'account.profilePhoto': 1,
  //         },
  //       },
  //     ]);

  //     const staffs = await this.schedulesShifts.aggregate([
  //       { $match: { classes: query.classId, type: 'class-work', deleted: false } },

  //       {
  //         $lookup: {
  //           from: 'accounts',
  //           localField: 'careTaker',
  //           foreignField: '_id',
  //           as: 'careTaker',
  //           pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
  //         },
  //       },
  //       { $unwind: { path: '$careTaker', preserveNullAndEmptyArrays: true } },

  //       {
  //         $lookup: {
  //           from: 'accounts',
  //           localField: 'homeworkChecker',
  //           foreignField: '_id',
  //           as: 'homeworkChecker',
  //           pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
  //         },
  //       },
  //       { $unwind: { path: '$homeworkChecker', preserveNullAndEmptyArrays: true } },

  //       {
  //         $lookup: {
  //           from: 'accounts',
  //           localField: 'staffs.id',
  //           foreignField: '_id',
  //           as: 'teachers',
  //           pipeline: [{ $project: { firstName: 1, lastName: 1 } }],
  //         },
  //       },

  //       {
  //         $project: {
  //           time: 1,
  //           schedule: 1,
  //           startDate: 1,
  //           room: 1,
  //           careTaker: 1,
  //           homeworkChecker: 1,
  //           teachers: 1,
  //         },
  //       },
  //     ]);

  //     const account = await this.accounts.findOne({ _id: tokenPayload.accountId });

  //     if (isEmpty(account)) {
  //       return ResponseHandlerService({
  //         success: false,
  //         httpCode: HttpStatus.NOT_FOUND,
  //         statusCode: STATUS_CODE.NOT_FOUND,
  //         message: 'No result(s) found of account',
  //       });
  //     }

  //     const testsOfClass = await this.testsOfClass.aggregate([
  //       {
  //         $match: {
  //           class: classId,
  //           ...(account.role === 'admin' ? {} : { status: 'published' }),
  //         },
  //       },
  //       // {
  //       //   $lookup: {
  //       //     from: 'classs',
  //       //     localField: 'class',
  //       //     foreignField: '_id',
  //       //     as: 'class',
  //       //   },
  //       // },
  //       // {
  //       //   $unwind: {
  //       //     path: '$class',
  //       //     preserveNullAndEmptyArrays: true,
  //       //   },
  //       // },

  //       {
  //         $lookup: {
  //           from: 'classes',
  //           localField: 'class',
  //           foreignField: '_id',
  //           as: 'class',
  //           pipeline: [
  //             {
  //               $sort: { createdAt: -1 },
  //             },
  //             {
  //               $lookup: {
  //                 from: 'courses',
  //                 localField: 'courses',
  //                 foreignField: '_id',
  //                 as: 'course',
  //                 pipeline: [
  //                   {
  //                     $project: {
  //                       name: 1,
  //                     },
  //                   },
  //                 ],
  //               },
  //             },
  //             {
  //               $unwind: {
  //                 path: '$course',
  //                 preserveNullAndEmptyArrays: true,
  //               },
  //             },
  //             {
  //               $project: {
  //                 name: 1,
  //                 course: 1,
  //               },
  //             },
  //           ],
  //         },
  //       },
  //       {
  //         $unwind: {
  //           path: '$class',
  //           preserveNullAndEmptyArrays: true,
  //         },
  //       },

  //       // {
  //       //   $lookup: {
  //       //     from: IELTSTestsOfClassPeriodsCN,
  //       //     localField: '_id',
  //       //     foreignField: 'testsOfClassId',
  //       //     as: 'periods',
  //       //     pipeline: [
  //       //       {
  //       //         $sort: { createdAt: -1 },
  //       //       },
  //       //       {
  //       //         $lookup: {
  //       //           from: IELTSTestsOfClassPeriodsSectionsCN,
  //       //           localField: '_id',
  //       //           foreignField: 'testsOfClassPeriodId',
  //       //           as: 'sections',
  //       //           pipeline: [
  //       //             {
  //       //               $lookup: {
  //       //                 from: IELTSTestsOfClassPeriodsSectionsTestsCN,
  //       //                 localField: '_id',
  //       //                 foreignField: 'testsOfClassPeriodSectionId',
  //       //                 as: 'tests',
  //       //                 pipeline: [
  //       //                   {
  //       //                     $project: {
  //       //                       createdBy: 1,
  //       //                       'test.name': 1,
  //       //                       'test.type': 1,
  //       //                       'test.duration': 1,
  //       //                     },
  //       //                   },
  //       //                 ],
  //       //               },
  //       //             },

  //       //             {
  //       //               $project: {
  //       //                 name: 1,
  //       //                 tests: 1,
  //       //                 createdBy: 1,
  //       //               },
  //       //             },
  //       //           ],
  //       //         },
  //       //       },
  //       //       {
  //       //         $project: {
  //       //           name: 1,
  //       //           sections: 1,
  //       //           createdBy: 1,
  //       //         },
  //       //       },
  //       //     ],
  //       //   },
  //       // },

  //       // {
  //       //   $project: {
  //       //     name: 1,
  //       //     description: 1,
  //       //     class: 1,
  //       //     // periods: 1,
  //       //     status: 1,
  //       //   },
  //       // },
  //     ]);

  //     if (isEmpty(testsOfClass)) {
  //       return ResponseHandlerService({
  //         success: false,
  //         httpCode: HttpStatus.NOT_FOUND,
  //         statusCode: STATUS_CODE.NOT_FOUND,
  //         message: 'No result(s) found of class',
  //       });
  //     }

  //     return ResponseHandlerService({
  //       success: true,
  //       httpCode: HttpStatus.OK,
  //       statusCode: STATUS_CODE.HAS_DATA,
  //       data: {
  //         students: students,
  //         test: testsOfClass[0],
  //         scheduleAndStaff: staffs[0], // Make sure that the schedule is tied up to one 'ongoing' class only
  //       },
  //     });
  //   } catch (error) {
  //     return ResponseHandlerService({
  //       success: false,
  //       httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
  //       statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
  //       message: 'Unable to process your data',
  //       errorDetails: error,
  //     });
  //   }
  // }

  public async getStudentTestDetails(query: GetStudentTestDetailsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const month = parseInt(query.date?.split('-')[0] || new Date().toLocaleDateString().split('/')[0], 10);
      const year = parseInt(query.date?.split('-')[1] || new Date().toLocaleDateString().split('/')[2], 10);

      const account = await this.accounts.aggregate([
        {
          $match: {
            _id: query.studentId,
          },
        },
        {
          $lookup: {
            from: StudentsTuitionAttendanceCN,
            localField: '_id',
            foreignField: 'student',
            as: 'student',
            pipeline: [
              {
                $match: {
                  classes: query.classId,
                },
              },
              {
                $project: {
                  records: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$records',
                          as: 'record',
                          cond: {
                            $and: [
                              { $eq: ['$$record.month', month] },
                              { $eq: ['$$record.year', year] },
                              { $eq: ['$$record.included', true] },
                              { $eq: ['$$record.enable', true] },
                            ],
                          },
                        },
                      },
                      as: 'record',
                      in: {
                        day: '$$record.day',
                        month: '$$record.month',
                        year: '$$record.year',
                        included: '$$record.included',
                        enable: '$$record.enable',
                      },
                    },
                  },
                },
              },
            ],
          },
        },
        {
          $unwind: '$student',
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            profilePhoto: 1,
            attendance: '$student.records',
          },
        },
      ]);

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found of account',
        });
      }

      const testsOfClass = await this.testsOfClass.aggregate([
        {
          $match: {
            class: query.classId,
            status: 'published',
          },
        },
        // {
        //   $lookup: {
        //     from: 'classs',
        //     localField: 'class',
        //     foreignField: '_id',
        //     as: 'class',
        //   },
        // },
        // {
        //   $unwind: {
        //     path: '$class',
        //     preserveNullAndEmptyArrays: true,
        //   },
        // },

        {
          $lookup: {
            from: 'classes',
            localField: 'class',
            foreignField: '_id',
            as: 'class',
            pipeline: [
              {
                $sort: { createdAt: -1 },
              },
              {
                $lookup: {
                  from: 'courses',
                  localField: 'courses',
                  foreignField: '_id',
                  as: 'course',
                  pipeline: [
                    {
                      $project: {
                        name: 1,
                      },
                    },
                  ],
                },
              },
              {
                $unwind: {
                  path: '$course',
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $project: {
                  name: 1,
                  course: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$class',
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: IELTSTestsOfClassPeriodsCN,
            localField: '_id',
            foreignField: 'testsOfClassId',
            as: 'periods',
            pipeline: [
              {
                $sort: { createdAt: -1 },
              },
              {
                $lookup: {
                  from: IELTSTestsOfClassPeriodsSectionsCN,
                  localField: '_id',
                  foreignField: 'testsOfClassPeriodId',
                  as: 'sections',
                  pipeline: [
                    {
                      $lookup: {
                        from: IELTSTestsOfClassPeriodsSectionsTestsCN,
                        localField: '_id',
                        foreignField: 'testsOfClassPeriodSectionId',
                        as: 'tests',
                        pipeline: [
                          /**
                           * We also look up at copied student's test to get the 'reviewed' test.
                           * We overlay the result the copied student's test reviewed.
                           */
                          {
                            $lookup: {
                              from: IELTSTestsOfClassPeriodsSectionsTestsStudentCN,
                              let: { testId: '$_id' },
                              as: 'student',
                              pipeline: [
                                {
                                  $match: {
                                    $expr: {
                                      $and: [{ $eq: ['$_id', '$$testId'] }, { $eq: ['$studentId', query.studentId] }],
                                    },
                                  },
                                },
                                {
                                  $project: {
                                    'test.submittedDate': 1,
                                    'test.variations': 1,
                                    teacherReviewed: 1,
                                  },
                                },
                              ],
                            },
                          },
                          {
                            $addFields: {
                              student: { $first: '$student' },
                            },
                          },
                          {
                            $addFields: {
                              'test.submittedDate': {
                                $ifNull: ['$student.test.submittedDate', '$test.submittedDate'],
                              },
                              'test.variations': {
                                $ifNull: ['$student.test.variations', '$test.variations'],
                              },
                              teacherReviewed: '$student.teacherReviewed',
                            },
                          },
                          {
                            $project: {
                              createdBy: 1,
                              teacherReviewed: 1,
                              'test.name': 1,
                              'test.type': 1,
                              'test.duration': 1,
                              'test.submittedDate': 1,
                              'test.variations.parts.items.score': 1,
                              'test.variations.parts.items.reviewed': 1,
                            },
                          },
                        ],
                      },
                    },

                    {
                      $project: {
                        name: 1,
                        teacherReviewed: 1,
                        type: 1,
                        tests: 1,
                        createdBy: 1,
                      },
                    },
                  ],
                },
              },

              {
                $addFields: {
                  totalReviewedSections: {
                    $sum: {
                      $map: {
                        input: '$sections',
                        as: 'section',
                        in: {
                          $cond: [
                            {
                              $anyElementTrue: {
                                $reduce: {
                                  input: '$$section.tests',
                                  initialValue: [],
                                  in: {
                                    $concatArrays: [
                                      '$$value',
                                      {
                                        $reduce: {
                                          input: '$$this.test.variations',
                                          initialValue: [],
                                          in: {
                                            $concatArrays: [
                                              '$$value',
                                              {
                                                $reduce: {
                                                  input: '$$this.parts',
                                                  initialValue: [],
                                                  in: {
                                                    $concatArrays: ['$$value', '$$this.items.reviewed'],
                                                  },
                                                },
                                              },
                                            ],
                                          },
                                        },
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                            1,
                            0,
                          ],
                        },
                      },
                    },
                  },
                },
              },

              {
                $project: {
                  name: 1,
                  sections: 1,
                  totalReviewedSections: '$totalReviewedSections',
                  createdBy: 1,
                },
              },
            ],
          },
        },

        {
          $project: {
            name: 1,
            description: 1,
            class: 1,
            periods: 1,
            status: 1,
          },
        },
      ]);

      if (isEmpty(testsOfClass)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found of class',
        });
      }

      const classInfo = await this.classes.findOne({ _id: query.classId }, { name: 1, courses: 1 });
      const courseInfo = await this.courses.findOne({ _id: classInfo.courses }, { name: 1 });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          student: account,
          test: testsOfClass[0],
          class: classInfo,
          course: courseInfo,
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

  public async redflags(query: GetRedflagsDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const redflags = await this.testsRedflags.find({ class: query.classId, student: query.studentId });

      if (isEmpty(redflags)) {
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
        data: redflags,
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

  public async addRedflag(body: AddRedflagDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsRedflags.create({
        message: body.message,
        class: body.classId,
        student: body.studentId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
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

  public async announcements(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const announcements = await this.testsAnnouncements.aggregate([
        {
          $match: {
            createdBy: tokenPayload.accountId,
          },
        },
        {
          $lookup: {
            from: 'accounts',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  firstName: 1,
                  lastName: 1,
                  profilePhoto: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$createdBy',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);

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

  public async announcementById(query: GetAnnouncementByIdDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const announcements = await this.testsAnnouncements.aggregate([
        {
          $match: {
            testsOfClass: query.testOfClassId,
          },
        },
        {
          $lookup: {
            from: 'accounts',
            localField: 'createdBy',
            foreignField: '_id',
            as: 'createdBy',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  firstName: 1,
                  lastName: 1,
                  profilePhoto: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: '$createdBy',
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);

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

  public async addAnnouncement(body: AddAnnouncementDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsAnnouncements.create({
        title: body.title,
        message: body.message,
        class: body.classId,
        student: body.studentId,
        testsOfClass: body.testOfClassId,
        createdBy: tokenPayload.accountId,
        properties: tokenPayload.propertyId,
        propertiesBranches: tokenPayload.branchId,
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully created',
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

  public async deleteAnnouncementById(announcementId: string, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.testsAnnouncements.deleteOne({ _id: announcementId });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_DELETED,
        message: 'Successfully created',
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

  public async getTotalPendingReviewsForAllStudents(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      const schedulesShifts = await this.schedulesShifts.find({ 'staffs.id': tokenPayload.accountId });

      const classIds = schedulesShifts.map((shift) => shift.classes);

      if (isEmpty(schedulesShifts)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'No result(s) found of account',
        });
      }

      const students = await this.studentsTuitionAttendance.aggregate([
        {
          $match: {
            classes: {
              $in: classIds,
            },
          },
        },

        {
          $project: {
            student: 1,
          },
        },

        {
          $lookup: {
            from: 'accounts',
            localField: 'student',
            foreignField: '_id',
            as: 'account',
          },
        },
        {
          $unwind: {
            path: '$account',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'ielts-tests-of-class-periods-sections-tests-student',
            localField: 'account._id',
            foreignField: 'studentId',
            as: 'tests',
            pipeline: [
              {
                $match: {
                  teacherReviewed: false,
                  'test.submittedDate': { $exists: true, $ne: null },
                  'test.variations.parts.items.reviewed': false,
                },
              },
            ],
          },
        },
        {
          $project: {
            pendingReviews: {
              $size: '$tests',
            },
          },
        },
        {
          $group: {
            _id: null,
            totalPendingReviews: {
              $sum: '$pendingReviews',
            },
          },
        },
        {
          $project: {
            _id: 0,
          },
        },
      ]);

      if (isEmpty(students[0])) {
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
        data: students[0],
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
