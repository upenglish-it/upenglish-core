import { DateTime } from 'luxon';
import { IStudentsTuitionAttendanceRecord } from '../../database/mongodb';

export const ConvertToDateTime = (payment: IStudentsTuitionAttendanceRecord) => {
  const { day, month, year } = payment;
  return DateTime.fromObject({ day, month, year });
};

// Function to get proceeding dates
export const GetProceedingDates = (
  stoppedDate: DateTime,
  tuitionPayments: Array<IStudentsTuitionAttendanceRecord>
): { previousPayments: IStudentsTuitionAttendanceRecord[]; remainingPayments: IStudentsTuitionAttendanceRecord[] } => {
  // Parse the stop date
  const stopYear = stoppedDate.year;
  const stopMonth = stoppedDate.month;
  const stopDay = stoppedDate.day;

  // Filter payments into remaining and previous
  const remainingPayments = [];
  const previousPayments = [];

  tuitionPayments.forEach((payment) => {
    const paymentYear = payment.year;
    const paymentMonth = payment.month;
    const paymentDay = payment.day;

    if (
      paymentYear > stopYear ||
      (paymentYear === stopYear && paymentMonth > stopMonth) ||
      (paymentYear === stopYear && paymentMonth === stopMonth && paymentDay >= stopDay)
    ) {
      remainingPayments.push(payment);
    } else {
      previousPayments.push(payment);
    }
  });

  return { remainingPayments, previousPayments };
};

// Define a custom comparison function for sorting
export const CompareDates = (a: IStudentsTuitionAttendanceRecord, b: IStudentsTuitionAttendanceRecord) => {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.month !== b.month) {
    return a.month - b.month;
  }
  return a.day - b.day;
};

// get the next available day
export const GetAvailableNextDay = (
  lookupIndex: number,
  records: IStudentsTuitionAttendanceRecord[]
): { index: number; record: IStudentsTuitionAttendanceRecord } => {
  const record = records[lookupIndex];

  if (record === undefined) {
    return null;
  }

  if (record.enable) {
    return GetAvailableNextDay(lookupIndex + 1, records);
  }

  return { index: lookupIndex, record: record };
};
