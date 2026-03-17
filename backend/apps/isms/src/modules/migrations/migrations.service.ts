import { HttpStatus, Injectable } from '@nestjs/common';
import { ReturnModelType } from '@typegoose/typegoose';
import {
  IResponseHandlerParams,
  Accounts,
  ResponseHandlerService,
  STATUS_CODE,
  ACCOUNT_ID,
  NOTIFICATION_DEFAULT_VALUE,
  AccountsProperties,
  Classes,
  StudentsTuitionAttendance,
  SYSTEM_ID,
  Courses,
} from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import { PCSheetsData, PHSheetsData } from './data';

@Injectable()
export class MigrationsService {
  constructor(
    @InjectModel(Classes) private readonly classes: ReturnModelType<typeof Classes>,
    @InjectModel(Courses) private readonly courses: ReturnModelType<typeof Courses>,
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(AccountsProperties) private readonly accountsProperties: ReturnModelType<typeof AccountsProperties>,
    @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>
  ) {}

  public async migrate(): Promise<IResponseHandlerParams> {
    try {
      const propertyId = 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea';
      // const branchId = 'UPE01HWDZJXAJZQT6S3RVSE74WK7E'; //Phú Cường
      const branchId = 'UPE01J14KFSS5H6JA93YWTDRB5RBK'; // Phú Hoà

      let courseId = '';

      if (branchId === 'UPE01J14KFSS5H6JA93YWTDRB5RBK') {
        courseId = 'UPE01KJ90QF6X79M2ZB54QC5QWRG1';
      } else if (branchId === 'UPE01HWDZJXAJZQT6S3RVSE74WK7E') {
        courseId = 'UPE01KJ913T745WTKSC8685R4QWYK';
      }

      // const sheetDate = DateTime.fromObject({ month: 7, day: 1, year: 2025 });
      // const dataFromSheet = [
      //   {
      //     'No.': '1',
      //     Class: 'CC003',
      //     'Tên Học viên': 'Ngô Ngọc Như Ý',
      //     'KH cố định': '',
      //     'Daily Streak': '',
      //     Voucher: '',
      //     'Học Phí Khoá': '6,068,000 đ',
      //     'Học Phí Tháng': '',
      //     CK: '07/03/2025',
      //     TM: '',
      //     None: 'FALSE',
      //     Done: 'TRUE',
      //     Note: 'HP 10/3 - 10/7',
      //     'BC TĐ HT': 'TRUE',
      //     'NV THU': '',
      //     'Total $': 'Total HPK',
      //   },

      //   {
      //     'No.': '131',
      //     Class: 'T8006',
      //     'Tên Học viên': 'Nguyễn Hạnh Dung (Hanna)',
      //     'KH cố định': '',
      //     'Daily Streak': '',
      //     Voucher: '',
      //     'Học Phí Khoá': '',
      //     'Học Phí Tháng': '2,190,000 đ',
      //     CK: '07/07/2025',
      //     TM: '',
      //     None: 'FALSE',
      //     Done: 'TRUE',
      //     Note: '',
      //     'BC TĐ HT': 'TRUE',
      //     'NV THU': '',
      //     'Total $': '',
      //   },
      // ];

      // const sheetsData = PHSheetsData;
      const sheetsData = PCSheetsData;
      // console.log('>>', sheetsData);

      // const sheetsData = [
      //   {
      //     date: '2025-07-01',
      //     items: [
      //       {
      //         '12561256': 93,
      //         Class: 'TC011',
      //         'Tên Học viên': 'Nguyễn Thị Huỳnh Mai',
      //         'Học Phí Khoá': 12432000,
      //         CK: '11/3/2025',
      //         'Chưa Hoàn Thành': false,
      //         'Đã hoàn thành': true,
      //         Note: 'Từ 17/3/2025-17/9/2025',
      //       },
      //     ],
      //   },
      // ];

      console.log('migration started');

      for (const sheet of sheetsData) {
        let itemsCompleted = 0;

        const origStartDate = DateTime.fromFormat(sheet.date, 'yyyy-MM-dd').startOf('month');
        const origEndDate = origStartDate.endOf('month');

        console.log('startDate', origStartDate.toISO());
        console.log('endDate', origEndDate.toISO());

        for (const item of sheet.items) {
          const className = item['Class'].trim(); // Class
          const studentName = item['Tên Học viên'].trim(); // Student Name
          // const fixedCourse = item['KH cố định']; // Fixed Course
          // const dailyStreak = item['Daily Streak']; // Daily Streak
          // const voucher = item['Voucher']; // Voucher
          const courseTuitionFee = item['Học Phí Khoá']; // Course Tuition Fee
          const monthlyTuitionFee = item['Học Phí Tháng']; // Monthly Tuition Fee

          let tuitionFee = 0;

          // const tuitionFee = monthlyTuitionFee || courseTuitionFee;
          if (!isEmpty(monthlyTuitionFee)) {
            tuitionFee = monthlyTuitionFee || 0;
          }

          if (!isEmpty(courseTuitionFee)) {
            tuitionFee = courseTuitionFee || 0;
          }

          const ckDate = item['CK']; // Bank Transfer Date
          const tmDate = item['TM']; // Cash Payment Date
          const none = item['None']; // None
          const done = item['Done']; // Done
          const note: string = item['Note']; // Note
          const progressReportCompleted = item['BC TĐ HT']; // Progress Report Completed
          const collectedBy = item['NV THU']; // Staff who collected
          const total = item['Total $']; // Total Course Tuition

          //--- Enroll the student to the class
          let startDate: DateTime = origStartDate;
          let endDate: DateTime = origEndDate;
          //
          if (!isEmpty(ckDate)) {
            const formattedDate = DateTime.fromFormat(ckDate, 'd/M/yyyy').toFormat('yyyy-MM-dd'); // change to your desired output format
            startDate = DateTime.fromFormat(formattedDate, 'yyyy-MM-dd');
            endDate = startDate;
            // console.log('>>>ckDate', ckDate, formattedDate, startDate.toISO(), endDate.toISO());
            // console.log('>>>ckDate 2');
          }
          if (!isEmpty(tmDate)) {
            const formattedDate = DateTime.fromFormat(tmDate, 'd/M/yyyy').toFormat('yyyy-MM-dd'); // change to your desired output format
            endDate = DateTime.fromFormat(formattedDate, 'yyyy-MM-dd');
            startDate = endDate;
            // console.log('>>>tmDate', tmDate, formattedDate, DateTime.fromFormat(tmDate, 'dd/MM/yyyy'), startDate.toISO(), endDate.toISO());
          }
          //--- if has a date range in the note
          // if (!isEmpty(note)) {
          //   console.log('>>>', note, ExtractHpDateRange(note, origStartDate.year) ? 'ok' : 'not ok', origStartDate.year, studentName);
          //   console.log('>>>', startDate.toISO(), endDate.toISO(), studentName);

          //   if (!isEmpty(ExtractHpDateRange(note, origStartDate.year)?.startDate)) {
          //     startDate = ExtractHpDateRange(note, origStartDate.year).startDate;
          //   }
          //   if (!isEmpty(ExtractHpDateRange(note, origStartDate.year)?.endDate)) {
          //     endDate = ExtractHpDateRange(note, origStartDate.year).endDate;
          //   }
          // }

          //--- Create the class
          let classData = await this.classes.findOne({ name: className, properties: propertyId, propertiesBranches: branchId });
          if (isEmpty(classData)) {
            classData = await this.classes.create({
              name: className.trim(),
              courses: courseId,
              properties: propertyId,
              propertiesBranches: branchId,
              status: 'ongoing',
            });
          }
          //--- Check the student if exists
          let studentData = await this.accounts.findOne({
            firstName: studentName,
          });
          if (isEmpty(studentData)) {
            const accountId = ACCOUNT_ID(`${studentName[0]}`);
            // Creation of account
            studentData = await this.accounts.create({
              accountId: accountId,
              firstName: studentName,
              lastName: '',
              emailAddresses: [],
              contactNumbers: [],
              gender: null,
              birthDate: null,
              address: {
                street: '',
                city: '',
                country: '',
                state: '',
                postalCode: '',
                timezone: '',
              },
              tags: [],
              sources: [],
              guardians: [],
              additionalNotes: '',
              properties: propertyId,
              propertiesBranches: [branchId],
              sourceBranch: branchId,
              language: 'en',
              notification: NOTIFICATION_DEFAULT_VALUE('student'),
              role: 'student',
              cmnd: '',
              official: true,
              createdFrom: 'migration',
              assignedTo: 'UPE01HN2AYWQ6A1ADH8E6A9QGXW8P',
            });
            /* Save associated property */
            await this.accountsProperties.create({
              accounts: studentData._id,
              properties: propertyId,
            });
          }

          if (isEmpty(startDate)) {
            console.error('Start date is empty for ', startDate, endDate, studentName);
          } else {
            const studentsTuitionAttendanceExist = await this.studentsTuitionAttendance.findOne({
              student: studentData._id,
              classes: classData._id,
            });
            if (!isEmpty(studentsTuitionAttendanceExist)) {
              const studentsTuitionAttendanceExistJSON = studentsTuitionAttendanceExist.toJSON();
              const isExist = studentsTuitionAttendanceExistJSON.records.find(
                (record) => record.month === startDate?.month && record.year === startDate?.year
              );
              if (isEmpty(isExist)) {
                studentsTuitionAttendanceExistJSON.records.push({
                  id: SYSTEM_ID(),
                  included: true,
                  enable: true,
                  paid: true,
                  paymentType: monthlyTuitionFee ? 'monthly' : 'package',
                  completed: true,
                  amount: tuitionFee,
                  paymentHistoryId: '',
                  hour: 0,
                  minute: 0,
                  notes: note,
                  day: startDate?.day,
                  month: startDate?.month,
                  year: startDate?.year,
                  status: 'present',
                  void: false,
                  createdAt: DateTime.now().toISO(),
                  paidOffDay: false,
                  savingsConsumed: false,
                  stoppedLearning: false,
                });
                this.studentsTuitionAttendance
                  .findOneAndUpdate(
                    { _id: studentsTuitionAttendanceExist._id },
                    {
                      $set: {
                        records: studentsTuitionAttendanceExistJSON.records,
                      },
                    }
                  )
                  .then((res) => {
                    console.log('Updated student tuition attendance for ', res);
                  })
                  .catch((error) => {
                    console.error('Error updating student tuition attendance for ', studentName, error);
                  });
              } else {
                console.log('no need to update ', studentName);
              }
            } else {
              console.error('Creating new student tuition attendance for ', studentName, startDate?.day, startDate?.month, startDate?.year);
              this.studentsTuitionAttendance
                .create({
                  records: [
                    {
                      id: SYSTEM_ID(),
                      included: true,
                      enable: true,
                      paid: true,
                      paymentType: monthlyTuitionFee ? 'monthly' : 'package',
                      completed: true,
                      amount: tuitionFee,
                      paymentHistoryId: '',
                      hour: 0,
                      minute: 0,
                      notes: note,
                      day: startDate?.day,
                      month: startDate?.month,
                      year: startDate?.year,
                      status: 'present',
                      void: false,
                      createdAt: DateTime.now().toISO(),
                      paidOffDay: false,
                      savingsConsumed: false,
                      stoppedLearning: false,
                    },
                  ],
                  changeLogs: [],
                  student: studentData._id,
                  schedulesShift: '---',
                  paymentHistory: [],
                  enrolledBy: 'UPE01HN2AYWQ6A1ADH8E6A9QGXW8P', // Quan Id
                  classes: classData._id,
                  status: 'ongoing',
                  reason: '',
                  properties: propertyId,
                  propertiesBranches: branchId,
                })
                .then(() => {
                  console.log('Created student tuition attendance for ', studentName);
                })
                .catch((error) => {
                  console.error('Error creating student tuition attendance for ', studentName, error);
                });
            }
          }

          itemsCompleted++;
          console.log(`${itemsCompleted} of ${sheet.items.length} items completed`);
        }
      }

      console.log('Successfully migrated');

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Successfully migrated',
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

  public async migrateData(): Promise<IResponseHandlerParams> {
    try {
      const classesData = [
        {
          name: 'CC003',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:21:55.499Z' },
          updatedAt: { $date: '2026-03-02T15:19:25.799Z' },
        },
        {
          name: 'CC004',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:21:57.745Z' },
          updatedAt: { $date: '2026-03-02T15:19:27.154Z' },
        },
        {
          name: 'J6006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:21:59.446Z' },
          updatedAt: { $date: '2026-03-02T15:19:34.135Z' },
        },
        {
          name: 'K2006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:00.525Z' },
          updatedAt: { $date: '2026-03-02T15:19:42.709Z' },
        },
        {
          name: 'F1078',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:01.012Z' },
          updatedAt: { $date: '2026-03-02T15:19:28.317Z' },
        },
        {
          name: 'J9006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:01.386Z' },
          updatedAt: { $date: '2026-03-02T15:19:40.235Z' },
        },
        {
          name: 'IC014',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:03.172Z' },
          updatedAt: { $date: '2026-03-02T15:19:32.923Z' },
        },
        {
          name: 'J6006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:10.172Z' },
          updatedAt: { $date: '2026-03-02T15:19:35.048Z' },
        },
        {
          name: 'J8006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:10.901Z' },
          updatedAt: { $date: '2026-03-02T15:19:36.477Z' },
        },
        {
          name: 'J8006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:14.510Z' },
          updatedAt: { $date: '2026-03-02T15:19:37.932Z' },
        },
        {
          name: 'K3006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:15.917Z' },
          updatedAt: { $date: '2026-03-02T15:19:43.958Z' },
        },
        {
          name: 'K2006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:18.307Z' },
          updatedAt: { $date: '2026-03-02T15:19:41.510Z' },
        },
        {
          name: 'K5006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:23.386Z' },
          updatedAt: { $date: '2026-03-02T15:19:48.578Z' },
        },
        {
          name: 'K3006.3',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:27.013Z' },
          updatedAt: { $date: '2026-03-02T15:19:45.061Z' },
        },
        {
          name: 'K4006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:28.474Z' },
          updatedAt: { $date: '2026-03-02T15:19:46.064Z' },
        },
        {
          name: 'K4006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:22:31.728Z' },
          updatedAt: { $date: '2026-03-02T15:19:47.443Z' },
        },
        {
          name: 'K5006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:36:10.319Z' },
          updatedAt: { $date: '2026-03-02T15:19:49.643Z' },
        },
        {
          name: 'T6006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:36:12.850Z' },
          updatedAt: { $date: '2026-03-02T15:19:53.086Z' },
        },
        {
          name: 'T8006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:36:16.570Z' },
          updatedAt: { $date: '2026-03-02T15:19:55.258Z' },
        },
        {
          name: 'P3006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:54:43.894Z' },
          updatedAt: { $date: '2026-03-02T15:19:51.697Z' },
        },
        {
          name: 'T7006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:54:47.227Z' },
          updatedAt: { $date: '2026-03-02T15:19:54.132Z' },
        },
        {
          name: 'K5006.3',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:55:01.618Z' },
          updatedAt: { $date: '2026-03-02T15:19:50.615Z' },
        },
        {
          name: 'F1080',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:55:19.200Z' },
          updatedAt: { $date: '2026-03-02T15:19:29.591Z' },
        },
        {
          name: 'F2078',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:56:47.666Z' },
          updatedAt: { $date: '2026-03-02T15:19:30.697Z' },
        },
        {
          name: 'F2080',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: true,
          createdAt: { $date: '2026-02-25T02:58:29.444Z' },
          updatedAt: { $date: '2026-03-02T15:19:31.839Z' },
        },
        {
          name: 'LT006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:19:49.667Z' },
          updatedAt: { $date: '2026-03-04T08:56:36.746Z' },
        },
        {
          name: 'PS006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:19:54.920Z' },
          updatedAt: { $date: '2026-03-04T08:56:39.995Z' },
        },
        {
          name: 'F2072',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:19:59.566Z' },
          updatedAt: { $date: '2026-03-04T08:55:23.670Z' },
        },
        {
          name: 'TC012',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:01.423Z' },
          updatedAt: { $date: '2026-03-04T08:56:48.260Z' },
        },
        {
          name: 'F1074',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:04.944Z' },
          updatedAt: { $date: '2026-03-04T08:55:14.288Z' },
        },
        {
          name: 'F1076',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:08.536Z' },
          updatedAt: { $date: '2026-03-04T08:55:15.447Z' },
        },
        {
          name: 'F1077',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:11.936Z' },
          updatedAt: { $date: '2026-03-04T08:55:17.004Z' },
        },
        {
          name: 'IC013',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:17.883Z' },
          updatedAt: { $date: '2026-03-04T08:55:29.245Z' },
        },
        {
          name: 'SP004',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:19.283Z' },
          updatedAt: { $date: '2026-03-04T08:56:41.148Z' },
        },
        {
          name: 'TC011',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:20.647Z' },
          updatedAt: { $date: '2026-03-04T08:56:46.618Z' },
        },
        {
          name: 'J8005,1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:23.472Z' },
          updatedAt: { $date: '2026-03-04T08:55:55.933Z' },
        },
        {
          name: 'K2005,2',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:23.844Z' },
          updatedAt: { $date: '2026-03-04T08:56:15.949Z' },
        },
        {
          name: 'J7006,1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:24.306Z' },
          updatedAt: { $date: '2026-03-04T08:55:49.939Z' },
        },
        {
          name: 'K5006,2',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:25.388Z' },
          updatedAt: { $date: '2026-03-04T08:56:31.193Z' },
        },
        {
          name: 'K3006,1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:26.173Z' },
          updatedAt: { $date: '2026-03-04T08:56:24.302Z' },
        },
        {
          name: 'F1079',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:27.554Z' },
          updatedAt: { $date: '2026-03-04T08:55:18.991Z' },
        },
        {
          name: 'K1006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:38.673Z' },
          updatedAt: { $date: '2026-03-04T08:56:01.450Z' },
        },
        {
          name: 'TC013',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:40.967Z' },
          updatedAt: { $date: '2026-03-04T08:56:49.493Z' },
        },
        {
          name: 'J9006,1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:53.355Z' },
          updatedAt: { $date: '2026-03-04T08:56:00.314Z' },
        },
        {
          name: 'J7006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:54.029Z' },
          updatedAt: { $date: '2026-03-04T08:55:47.397Z' },
        },
        {
          name: 'K5006.2',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:20:55.690Z' },
          updatedAt: { $date: '2026-03-04T08:56:33.468Z' },
        },
        {
          name: 'K3006,4',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:21:07.206Z' },
          updatedAt: { $date: '2026-03-04T08:56:25.566Z' },
        },
        {
          name: 'J6006,2',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:21:07.461Z' },
          updatedAt: { $date: '2026-03-04T08:55:45.224Z' },
        },
        {
          name: 'CC005',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:21:30.297Z' },
          updatedAt: { $date: '2026-03-04T08:55:13.262Z' },
        },
        {
          name: 'F2077',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:21:32.122Z' },
          updatedAt: { $date: '2026-03-04T08:55:24.868Z' },
        },
        {
          name: 'F1081',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:21:36.945Z' },
          updatedAt: { $date: '2026-03-04T08:55:21.629Z' },
        },
        {
          name: 'IC015',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:21:38.733Z' },
          updatedAt: { $date: '2026-03-04T08:55:43.155Z' },
        },
        {
          name: 'F2079',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:22:12.634Z' },
          updatedAt: { $date: '2026-03-04T08:55:27.132Z' },
        },
        {
          name: 'F1082',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:22:19.618Z' },
          updatedAt: { $date: '2026-03-04T08:55:22.777Z' },
        },
        {
          name: 'K1006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:22:25.126Z' },
          updatedAt: { $date: '2026-03-04T08:56:15.012Z' },
        },
        {
          name: 'J6006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T03:41:53.763Z' },
          updatedAt: { $date: '2026-03-04T08:55:46.198Z' },
        },
        {
          name: 'CC003',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:20.182Z' },
          updatedAt: { $date: '2026-03-04T08:55:10.819Z' },
        },
        {
          name: 'CC004',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:21.309Z' },
          updatedAt: { $date: '2026-03-04T08:55:12.113Z' },
        },
        {
          name: 'J6006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:22.255Z' },
          updatedAt: { $date: '2026-03-04T08:55:44.180Z' },
        },
        {
          name: 'K2006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:22.835Z' },
          updatedAt: { $date: '2026-03-04T08:56:20.831Z' },
        },
        {
          name: 'F1078',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:23.081Z' },
          updatedAt: { $date: '2026-03-04T08:55:17.946Z' },
        },
        {
          name: 'J9006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:23.349Z' },
          updatedAt: { $date: '2026-03-04T08:55:59.283Z' },
        },
        {
          name: 'IC014',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:24.279Z' },
          updatedAt: { $date: '2026-03-04T08:55:31.632Z' },
        },
        {
          name: 'J8006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:28.620Z' },
          updatedAt: { $date: '2026-03-04T08:55:57.037Z' },
        },
        {
          name: 'J8006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:30.557Z' },
          updatedAt: { $date: '2026-03-04T08:55:58.227Z' },
        },
        {
          name: 'K3006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:31.291Z' },
          updatedAt: { $date: '2026-03-04T08:56:23.188Z' },
        },
        {
          name: 'K2006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:32.600Z' },
          updatedAt: { $date: '2026-03-04T08:56:19.101Z' },
        },
        {
          name: 'K5006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:35.251Z' },
          updatedAt: { $date: '2026-03-04T08:56:30.104Z' },
        },
        {
          name: 'K3006.3',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:37.281Z' },
          updatedAt: { $date: '2026-03-04T08:56:26.648Z' },
        },
        {
          name: 'K4006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:38.067Z' },
          updatedAt: { $date: '2026-03-04T08:56:27.899Z' },
        },
        {
          name: 'K4006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:39.515Z' },
          updatedAt: { $date: '2026-03-04T08:56:28.887Z' },
        },
        {
          name: 'K5006.1',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:41.166Z' },
          updatedAt: { $date: '2026-03-04T08:56:32.378Z' },
        },
        {
          name: 'T6006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:42.072Z' },
          updatedAt: { $date: '2026-03-04T08:56:42.553Z' },
        },
        {
          name: 'T8006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:28:44.087Z' },
          updatedAt: { $date: '2026-03-04T08:56:44.960Z' },
        },
        {
          name: 'P3006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:29:06.298Z' },
          updatedAt: { $date: '2026-03-04T08:56:38.359Z' },
        },
        {
          name: 'T7006',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:29:08.630Z' },
          updatedAt: { $date: '2026-03-04T08:56:43.710Z' },
        },
        {
          name: 'K5006.3',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:29:20.389Z' },
          updatedAt: { $date: '2026-03-04T08:56:35.521Z' },
        },
        {
          name: 'F1080',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:29:35.492Z' },
          updatedAt: { $date: '2026-03-04T08:55:20.294Z' },
        },
        {
          name: 'F2078',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:30:35.209Z' },
          updatedAt: { $date: '2026-03-04T08:55:26.024Z' },
        },
        {
          name: 'F2080',
          typeOfRate: 'monthly-rate',
          status: 'ongoing',
          courses: 'UPE01KJ90QF6X79M2ZB54QC5QWRG1',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
          deleted: true,
          createdAt: { $date: '2026-02-25T04:31:58.901Z' },
          updatedAt: { $date: '2026-03-04T08:55:28.060Z' },
        },
        {
          name: 'LT006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQJ377TBWCS6AN8J2V8GM9N',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:21:06.768Z' },
          updatedAt: { $date: '2026-03-02T15:21:06.768Z' },
        },
        {
          name: 'K2006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGHJZ6R154QB0WMEWXJW5W',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:23:16.520Z' },
          updatedAt: { $date: '2026-03-02T15:23:16.520Z' },
        },
        {
          name: 'K2006.1',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGHJZ6R154QB0WMEWXJW5W',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:23:32.416Z' },
          updatedAt: { $date: '2026-03-02T15:23:32.416Z' },
        },
        {
          name: 'K3006.2',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGKJKAC0PF8ANPNC3W5ZRT',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:24:25.801Z' },
          updatedAt: { $date: '2026-03-02T15:24:25.801Z' },
        },
        {
          name: 'K3006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGKJKAC0PF8ANPNC3W5ZRT',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:25:05.951Z' },
          updatedAt: { $date: '2026-03-02T15:25:05.951Z' },
        },
        {
          name: 'K3006.3',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGKJKAC0PF8ANPNC3W5ZRT',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:25:19.550Z' },
          updatedAt: { $date: '2026-03-02T15:25:19.550Z' },
        },
        {
          name: 'K5006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGRTSTZR4AQ44PX3B00C2A',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:25:31.244Z' },
          updatedAt: { $date: '2026-03-02T15:25:31.244Z' },
        },
        {
          name: 'J6006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHK539T2SY97HC7HT8DJVX',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:25:46.615Z' },
          updatedAt: { $date: '2026-03-02T15:25:46.615Z' },
        },
        {
          name: 'J6006.1',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHK539T2SY97HC7HT8DJVX',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:26:20.445Z' },
          updatedAt: { $date: '2026-03-02T15:26:20.445Z' },
        },
        {
          name: 'T6006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQH03P666R3DR4AENRD7MK7',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:26:33.667Z' },
          updatedAt: { $date: '2026-03-02T15:26:33.667Z' },
        },
        {
          name: 'T7006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHBC6E4JVAKTREPYJ6QC76',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:26:45.165Z' },
          updatedAt: { $date: '2026-03-02T15:26:45.165Z' },
        },
        {
          name: 'IC014',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQJ0C7KXSN4BE9H6GW4A63N',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:27:07.407Z' },
          updatedAt: { $date: '2026-03-02T15:27:07.407Z' },
        },
        {
          name: 'K1006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGJSWB1V5TP8APXSDKBB78',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:27:27.601Z' },
          updatedAt: { $date: '2026-03-02T15:27:27.601Z' },
        },
        {
          name: 'J7006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHKV3W61BN6V7802QCWZFT',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:27:42.049Z' },
          updatedAt: { $date: '2026-03-02T15:27:42.049Z' },
        },
        {
          name: 'F1081',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHP78T61NH8VPK7AV2BGAS',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:28:49.916Z' },
          updatedAt: { $date: '2026-03-02T15:28:49.916Z' },
        },
        {
          name: 'TC012',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHX5FBB9A6CBKVQAK4M0R9',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:29:01.407Z' },
          updatedAt: { $date: '2026-03-02T15:29:01.407Z' },
        },
        {
          name: 'IC015',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHZPS8WH9GXWGVZSQHYF8V',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:29:13.496Z' },
          updatedAt: { $date: '2026-03-02T15:29:13.496Z' },
        },
        {
          name: '***P3006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGKJKAC0PF8ANPNC3W5ZRT',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:29:45.246Z' },
          updatedAt: { $date: '2026-03-02T15:29:45.246Z' },
        },
        {
          name: 'K4006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGR4RHW2P5YSTR3CKTN66X',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:30:00.220Z' },
          updatedAt: { $date: '2026-03-02T15:30:00.220Z' },
        },
        {
          name: 'K4006.1',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGR4RHW2P5YSTR3CKTN66X',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:30:13.513Z' },
          updatedAt: { $date: '2026-03-02T15:30:13.513Z' },
        },
        {
          name: 'K5006.1',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGRTSTZR4AQ44PX3B00C2A',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:30:25.315Z' },
          updatedAt: { $date: '2026-03-02T15:30:25.315Z' },
        },
        {
          name: 'K5006.3',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGRTSTZR4AQ44PX3B00C2A',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:30:38.239Z' },
          updatedAt: { $date: '2026-03-02T15:30:38.239Z' },
        },
        {
          name: 'J8006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHME8XEJYGQ86YVHAPMTYH',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:30:49.915Z' },
          updatedAt: { $date: '2026-03-02T15:30:49.915Z' },
        },
        {
          name: 'T8006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHC40G858S564JFMJAMKKK',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:31:01.949Z' },
          updatedAt: { $date: '2026-03-02T15:31:01.949Z' },
        },
        {
          name: 'J9006',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHNAN6R0TVESZ9Z67M2VVM',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:31:10.470Z' },
          updatedAt: { $date: '2026-03-02T15:31:10.470Z' },
        },
        {
          name: 'F2080',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHQQVGX9NY6J575MK8KMWZ',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:31:18.838Z' },
          updatedAt: { $date: '2026-03-02T15:31:18.838Z' },
        },
        {
          name: 'F2078',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHQQVGX9NY6J575MK8KMWZ',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:31:33.382Z' },
          updatedAt: { $date: '2026-03-02T15:31:33.382Z' },
        },
        {
          name: 'K1006.1',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQGJSWB1V5TP8APXSDKBB78',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:31:49.196Z' },
          updatedAt: { $date: '2026-03-02T15:31:49.196Z' },
        },
        {
          name: 'J6006.2',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHK539T2SY97HC7HT8DJVX',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:32:00.540Z' },
          updatedAt: { $date: '2026-03-02T15:32:00.540Z' },
        },
        {
          name: 'TC014',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHWBKK2GQ5CDCPHCK28KF4',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:32:16.248Z' },
          updatedAt: { $date: '2026-03-02T15:32:16.248Z' },
        },
        {
          name: 'F2079',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHQQVGX9NY6J575MK8KMWZ',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:32:28.966Z' },
          updatedAt: { $date: '2026-03-02T15:32:28.966Z' },
        },
        {
          name: 'F1082',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHP78T61NH8VPK7AV2BGAS',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:32:38.883Z' },
          updatedAt: { $date: '2026-03-02T15:32:38.883Z' },
        },
        {
          name: 'CC005',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHS839XD2D69XJ77F8WEZY',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:32:48.273Z' },
          updatedAt: { $date: '2026-03-02T15:32:48.273Z' },
        },
        {
          name: 'J9006.1',
          typeOfRate: 'hourly-rate',
          status: 'not-started',
          courses: 'UPE01KJQHNAN6R0TVESZ9Z67M2VVM',
          properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
          deleted: false,
          createdAt: { $date: '2026-03-02T15:33:11.054Z' },
          updatedAt: { $date: '2026-03-02T15:33:11.054Z' },
        },
      ];

      for (const classDatax of classesData) {
        delete classDatax.createdAt;
        delete classDatax.updatedAt;
        await this.classes.create({
          ...classDatax,
          propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
        });

        await this.classes.create({
          ...classDatax,
          propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
        });
      }

      // const coursesData = [
      //   {
      //     name: 'K2 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 97500,
      //     hourlyPackagePrice: 78000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T14:51:55.240Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:11.714Z',
      //     },
      //   },
      //   {
      //     name: 'K1 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 97500,
      //     hourlyPackagePrice: 78000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T14:52:35.085Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:18.860Z',
      //     },
      //   },
      //   {
      //     name: 'K3 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 97500,
      //     hourlyPackagePrice: 78000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T14:53:00.404Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:24.598Z',
      //     },
      //   },
      //   {
      //     name: 'K4 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 98500,
      //     hourlyPackagePrice: 78500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T14:55:30.066Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:29.132Z',
      //     },
      //   },
      //   {
      //     name: 'K5 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 100162,
      //     hourlyPackagePrice: 80500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T14:55:52.635Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:34.318Z',
      //     },
      //   },
      //   {
      //     name: 'T6 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 103500,
      //     hourlyPackagePrice: 77500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T14:59:51.111Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:39.800Z',
      //     },
      //   },
      //   {
      //     name: 'T7 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 109000,
      //     hourlyPackagePrice: 81500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:06:00.273Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:45.620Z',
      //     },
      //   },
      //   {
      //     name: 'T8 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 109000,
      //     hourlyPackagePrice: 81500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:06:24.657Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:51.254Z',
      //     },
      //   },
      //   {
      //     name: 'T9 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 112000,
      //     hourlyPackagePrice: 84000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:07:03.833Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:08:56.323Z',
      //     },
      //   },
      //   {
      //     name: 'J6 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 84000,
      //     hourlyPackagePrice: 73500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:10:15.146Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:10:15.146Z',
      //     },
      //   },
      //   {
      //     name: 'J7 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 84000,
      //     hourlyPackagePrice: 73500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:10:37.693Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:10:37.693Z',
      //     },
      //   },
      //   {
      //     name: 'J8 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 84500,
      //     hourlyPackagePrice: 74000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:10:57.310Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:10:57.310Z',
      //     },
      //   },
      //   {
      //     name: 'J9 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 85500,
      //     hourlyPackagePrice: 75000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:11:26.375Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:11:26.375Z',
      //     },
      //   },
      //   {
      //     name: 'F1 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 105000,
      //     hourlyPackagePrice: 84000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:11:55.675Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:11:55.675Z',
      //     },
      //   },
      //   {
      //     name: 'F2 - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 105000,
      //     hourlyPackagePrice: 84000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:12:45.426Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:28:39.948Z',
      //     },
      //   },
      //   {
      //     name: 'CC - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 105000,
      //     hourlyPackagePrice: 84000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:13:34.826Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:13:34.826Z',
      //     },
      //   },
      //   {
      //     name: 'TC (Đọc - Nghe) - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 118500,
      //     hourlyPackagePrice: 94500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:15:16.727Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:15:16.727Z',
      //     },
      //   },
      //   {
      //     name: 'TC (Nói - Viết) - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 126000,
      //     hourlyPackagePrice: 100500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:15:43.212Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:15:43.212Z',
      //     },
      //   },
      //   {
      //     name: 'IC (Preparation) - Jun 2025',
      //     price: 2990000,
      //     hourlyMonthlyPrice: 114000,
      //     hourlyPackagePrice: 91000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:17:06.482Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-04T07:43:58.819Z',
      //     },
      //   },
      //   {
      //     name: 'IC (Test drill) - Jun 2025',
      //     price: 2990000,
      //     hourlyMonthlyPrice: 114000,
      //     hourlyPackagePrice: 91000,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:17:28.436Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-04T07:43:48.527Z',
      //     },
      //   },
      //   {
      //     name: 'PS - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 86000,
      //     hourlyPackagePrice: 74500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:18:07.072Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:18:07.072Z',
      //     },
      //   },
      //   {
      //     name: 'DP - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 85500,
      //     hourlyPackagePrice: 79500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:18:34.082Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:18:34.082Z',
      //     },
      //   },
      //   {
      //     name: 'LT - Jun 2025',
      //     price: 0,
      //     hourlyMonthlyPrice: 85500,
      //     hourlyPackagePrice: 79500,
      //     material: null,
      //     properties: 'dfcb3802-6ba7-4f5a-8e45-dcdc31fde8ea',
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //     deleted: false,
      //     createdAt: {
      //       $date: '2026-03-02T15:19:01.627Z',
      //     },
      //     updatedAt: {
      //       $date: '2026-03-02T15:19:01.627Z',
      //     },
      //   },
      // ];

      // for (const course of coursesData) {
      //   delete course.createdAt;
      //   delete course.updatedAt;

      //   await this.courses.create({
      //     ...course,
      //     propertiesBranches: 'UPE01HWDZJXAJZQT6S3RVSE74WK7E',
      //   });

      //   await this.courses.create({
      //     ...course,
      //     propertiesBranches: 'UPE01J14KFSS5H6JA93YWTDRB5RBK',
      //   });
      // }
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

interface ExtractedDateRange {
  raw: string;
  startDate: DateTime | null;
  endDate: DateTime | null;
}

const ExtractHpDateRange = (code: string, text: string, year = DateTime.now().year): ExtractedDateRange | null => {
  // Match: HP 1/8 - 31/10 (allow spaces + escaped slashes)
  const regex = /code\s*(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})/i;

  const match = text.replace(/\\\//g, '/').match(regex);

  if (!match) return null;

  const [, startDay, startMonth, endDay, endMonth] = match;

  // console.log('startDay, startMonth, endDay, endMonth', startDay, startMonth, endDay, endMonth);

  const start = DateTime.fromObject({
    day: Number(startDay),
    month: Number(startMonth),
    year,
  });

  const end = DateTime.fromObject({
    day: Number(endDay),
    month: Number(endMonth),
    year,
  });

  return {
    raw: match[0],
    startDate: start.isValid ? start : null,
    endDate: end.isValid ? end : null,
  };
};
