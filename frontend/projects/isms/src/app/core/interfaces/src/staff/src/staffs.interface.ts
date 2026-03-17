import { IAccount } from "../../account/account.interface";
import { IScheduleSchedulesShift } from "../../schedule";

export type EmploymentInformation = {
  _id: string;
  salaryPackageId: string;
  dateHired: string;
  salaryIncrease: { count: number; type: "year" | "month" | "day" };

  // position: string;
  // typeOfLabor: string;
  // workSchedule: number[];
  // basicSalary: number;
  // dailySalary: number;
  // consultingCommission: number;
  // hourlyTeachingRate: number;
  // hourlyTutoringRate: number;
  // hourlyTAPARate: number;
  // insuranceAmount: number;
  // employeePay: number;
  // companyPay: number;
  // changeLogs: IEmploymentSettingsChangeLog[];
  addedBy: string;
  staff: IAccount;
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;

  // Added for dashboard
  yearsSinceHired?: number;
};

export interface IEmploymentSettingsChangeLog {
  action: "insert" | "update";
  createdAt: string;
}

export type StaffSalaryPayment = {
  _id: string;
  urlCode: string;
  transactionId: string;
  dateIssued: string;
  workStartDate: string;
  workEndDate: string;
  basicSalary: number;
  dailySalary: number;
  absences: string;
  consultingCommission: number;
  consultingCommissionQuantity: number;
  hourlyTeachingRate: number;
  hourlyTeachingRateQuantity: number;
  hourlyTutoringRate: number;
  hourlyTutoringRateQuantity: number;
  hourlyTAPARate: number;
  hourlyTAPARateQuantity: number;
  addition: number;
  subtraction: number;
  insuranceAmount: number;
  employeePay: number;
  companyPay: number;
  performedBy: string;
  staff: string;
  properties: string;
  propertiesBranches: string;
};

// export interface IStaffSalaryHistory {
//   _id: string;
//   dateIssued: string;
//   workStartDate: string;
//   workEndDate: string;

//   basicSalary: number;
//   dailySalary: number;
//   consultingCommission: number;
//   hourlyTeachingRate: number;
//   hourlyTutoringRate: number;
//   hourlyTAPARate: number;
//   addition: number;
//   subtraction: number;
//   insuranceAmount: number;
//   employeePay: number;
//   companyPay: number;
//   addedBy: string;
//   staff: string;
//   properties: string;
//   propertiesBranches: string;
//   deleted: false;
//   createdAt: string;
//   updatedAt: string;

// }

export type StaffSalaryPackage = {
  _id: string;
  name: string;
  jobTitle: string;
  typeOfLabor: string;
  basicSalary: number;
  dailySalary: number;
  consultingCommission: number;
  hourlyTeachingRate: number;
  hourlyTutoringRate: number;
  hourlyTAPARate: number;
  addition: number;
  subtraction: number;
  insuranceAmount: number;
  employeePay: number;
  companyPay: number;
  addedBy: string;
  staff: string;
  properties: string;
  propertiesBranches: string;
  deleted: false;
  createdAt: string;
  updatedAt: string;

  // added not in the data
  // staffWorkDailyRate: number;
  // staffWorkTotalStaffSalary: number;
  // staffWorkTotalStaffWorkDays: number;
  // staffWorkDaysInAMonthWithSalary: Array<{ amount: number; date: string }>;
  // tapaWorkDaysInAMonth: Array<string>;
  // totalOfUnpaidHours: number;
  // totalAmountOfUnpaidHours: number;
};

export type StaffSalaryAdvancement = {
  _id: string;
  loanedAmount: number;
  paidAmount: number;
  paymentSequence: number;
  agreement: {
    amount: number;
    every: number;
  };
  staff: string;
  properties: string;
  propertiesBranches: string;
  deleted: false;
  createdAt: string;
  updatedAt: string;

  // added in FE
  remainingBalance?: number;
};

export type StaffSalaryByDate = {
  alreadyReceivedSalary: boolean;
  staffSalaryStartDate: string;
  staffSalaryEndDate: string;
  employmentInformation: EmploymentInformation;
  salaryPackage: StaffSalaryPackage;
  staffSalaryPayment: StaffSalaryPayment;
  schedulesShifts: IScheduleSchedulesShift;
  staffWorkAccumulated: SalaryPackageAccumulated;
  classWorkAccumulated: SalaryPackageAccumulated;
  tutoringWorkAccumulated: SalaryPackageAccumulated;
  tapaWorkAccumulated: SalaryPackageAccumulated;
};

interface SalaryPackageAccumulated {
  basicSalary?: number;
  dailyRate?: number; // used in staff-work
  hourlyRate: number;
  workDaysWithSalary: Array<any>;
  originalSalary: number;
  totalSalary: number;
  totalWorkDays: number;
  unpaidHours: number;
  amountOfUnpaidHours: number;
  totalPaidHours: number;
  amountOfPaidHours: number;
  quantity?: number; // used in class-work, tutoring-work, tapa-work
}
