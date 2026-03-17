import { NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { IAccount, StaffSalaryPackage } from "@isms-core/interfaces";
import { ProofOfPaymentService } from "@isms-core/services";
import { Animations } from "@isms-core/constants";
import { lastValueFrom } from "rxjs";
import { FormattedCurrencyPipe } from "@isms-core/pipes";

@Component({
  templateUrl: "./staff-payslip.page.html",
  styleUrls: ["./staff-payslip.page.scss"],
  animations: [Animations.down],
  imports: [NgIf, FormattedCurrencyPipe],
})
export class StaffPayslipPage implements OnInit {
  public staffPayslip: IStaffPayslip = null;

  constructor(
    private readonly proofOfPaymentService: ProofOfPaymentService,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    const urlCode = this.activatedRoute.snapshot.queryParams["urlCode"];
    lastValueFrom(this.proofOfPaymentService.fetchStaffPayslip(urlCode)).then((res) => {
      if (res.success) {
        this.staffPayslip = res.data;
        setTimeout(() => window.print(), 1000);
      }
    });
  }

  public get computedInsuranceAmount(): number {
    const insuranceAmount = this.staffPayslip.insuranceAmount;
    const companyPay = this.staffPayslip.companyPay;
    const employeePay = this.staffPayslip.employeePay;
    return ((companyPay + employeePay) / 100) * insuranceAmount;
  }

  public get totalAmount(): number {
    const absences = this.staffPayslip.dailySalary * this.staffPayslip.absences;
    const basicSalary = this.staffPayslip.basicSalary - absences;

    const consultingCommissionTotal = this.staffPayslip.consultingCommission * this.staffPayslip.consultingCommissionQuantity;
    const hourlyTeachingRateTotal = this.staffPayslip.hourlyTeachingRate * this.staffPayslip.hourlyTeachingRateQuantity;
    const hourlyTutoringRateTotal = this.staffPayslip.hourlyTutoringRate * this.staffPayslip.hourlyTutoringRateQuantity;
    const hourlyTAPARateTotal = this.staffPayslip.hourlyTAPARate * this.staffPayslip.hourlyTAPARateQuantity;

    return basicSalary + consultingCommissionTotal + hourlyTeachingRateTotal + hourlyTutoringRateTotal + hourlyTAPARateTotal;
  }
}

interface IStaffPayslip {
  _id: string;
  dateIssued: string;
  workStartDate: string;
  workEndDate: string;
  absences: number;
  basicSalary: number;
  dailySalary: number;
  consultingCommission: number;
  consultingCommissionQuantity: number;
  hourlyTeachingRate: number;
  hourlyTeachingRateQuantity: number;
  hourlyTutoringRate: number;
  hourlyTutoringRateQuantity: number;
  hourlyTAPARate: number;
  hourlyTAPARateQuantity: number;
  insuranceAmount: number;
  employeePay: number;
  companyPay: number;
  urlCode: string;
  transactionId: string;
  account: IAccount;
  staffsEmploymentInformation: StaffSalaryPackage;
  salaryAdvancementLoanedAmount: number;
  salaryAdvancementAmountPay: number;
  salaryAdvancementBalance: number;
  totalOfUnpaidHours: number;
  totalAmountOfUnpaidHours: number;
  totalStaffSalary: number;
}
