import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { IAddress, IContactNumber } from 'apps/common';

// export class CreateStaffSalaryDTO {
//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '51865ef9-e84e-47cd-af41-bc5014cdf936' })
//   readonly staff: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '1' })
//   readonly month: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '2023' })
//   readonly year: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: 'Academic Manager' })
//   readonly position: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: 'full-time' })
//   readonly typeOfLabor: string;

//   @JoiSchema(Joi.array().required())
//   @ApiProperty({ example: [1, 2, 3] })
//   readonly workSchedule: Array<number>;
//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '2023-03-26' })
//   readonly startDate: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '2023-03-26' })
//   readonly endDate: string;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 5000 })
//   readonly basicSalary: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 100 })
//   readonly consultingCommission: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 200 })
//   readonly hourlyTeachingRate: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 50 })
//   readonly hourlyTutoringRate: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 50 })
//   readonly hourlyTAPARate: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 5000 })
//   readonly insuranceSalary: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 10.5 })
//   readonly employeePay: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 21.5 })
//   readonly companyPay: number;
// }

// export class SetStaffSalaryDTO {
//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '51865ef9-e84e-47cd-af41-bc5014cdf936' })
//   readonly staff: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: 'Academic Manager' })
//   readonly position: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: 'full-time' })
//   readonly typeOfLabor: string;

//   @JoiSchema(Joi.array().required())
//   @ApiProperty({ example: [1, 2, 3] })
//   readonly workSchedule: Array<number>;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 5000 })
//   readonly basicSalary: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 5000 })
//   readonly dailySalary: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 100 })
//   readonly consultingCommission: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 200 })
//   readonly hourlyTeachingRate: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 50 })
//   readonly hourlyTutoringRate: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 50 })
//   readonly hourlyTAPARate: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 32 })
//   readonly insuranceAmount: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 10.5 })
//   readonly employeePay: number;

//   @JoiSchema(Joi.number().required())
//   @ApiProperty({ example: 21.5 })
//   readonly companyPay: number;
// }

export class SavePaymentSalaryDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '51865ef9-e84e-47cd-af41-bc5014cdf936' })
  readonly staff: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: {} })
  readonly records: any;
}

// export class FetchStaffSalaryByMonthDTO {
//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '51865ef9-e84e-47cd-af41-bc5014cdf936' })
//   readonly staff: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '1' })
//   readonly month: string;

//   @JoiSchema(Joi.string().required())
//   @ApiProperty({ example: '2023' })
//   readonly year: string;
// }

export class UpdateStaffPersonalInformationDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'teacher' })
  readonly role: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Juan' })
  readonly firstName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Dela Cruz' })
  readonly lastName: string;

  @JoiSchema(Joi.array().min(1).max(1).items(Joi.string().email().required()).optional())
  @ApiProperty({ example: ['johndoe@yopmail.com'] })
  readonly emailAddresses: Array<string>;

  @JoiSchema(
    Joi.array().items(
      Joi.object({
        countryCallingCode: Joi.string().required(),
        number: Joi.string().required(),
      }).required(),
    ),
  )
  @ApiProperty({ example: [{ countryCallingCode: '+63', number: '9282122241' }] })
  readonly contactNumbers: Array<IContactNumber>;

  @JoiSchema(Joi.string().valid('male', 'female').optional())
  @ApiProperty({ example: 'male' })
  readonly gender: string;

  @JoiSchema(Joi.date().required())
  @ApiProperty({ example: 'male' })
  readonly birthDate: string;

  @JoiSchema(
    Joi.array().items(
      Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        country: Joi.string().required(),
        state: Joi.string().required(),
        postalCode: Joi.number().required(),
        timezone: Joi.string().required(),
      }).required(),
    ),
  )
  @ApiProperty({
    example: {
      street: 'Room 428',
      city: 'Saginaw',
      country: 'US',
      state: 'Michigan',
      postalCode: 48604,
      timezone: 'America/Denver',
    },
  })
  readonly address: IAddress;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['beginner'] })
  readonly tags: Array<string>;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['facebook'] })
  readonly sources: Array<string>;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly branches: Array<string>;

  @JoiSchema(Joi.boolean().valid(true, false).required())
  @ApiProperty({ example: false })
  readonly active: boolean;
}

export class UpdateStaffEmploymentSettingsDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '51865ef9-e84e-47cd-af41-bc5014cdf936' })
  readonly staffId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Academic Manager' })
  readonly position: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'full-time' })
  readonly typeOfLabor: string;

  @JoiSchema(Joi.array().required())
  @ApiProperty({ example: [1, 2, 3] })
  readonly workSchedule: Array<number>;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 5000 })
  readonly basicSalary: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 5000 })
  readonly dailySalary: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 100 })
  readonly consultingCommission: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 200 })
  readonly hourlyTeachingRate: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 50 })
  readonly hourlyTutoringRate: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 50 })
  readonly hourlyTAPARate: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 32 })
  readonly insuranceAmount: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 10.5 })
  readonly employeePay: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 21.5 })
  readonly companyPay: number;
}

export class SetStaffSalaryByDateDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '2023-08-15T10:10:26.435Z' })
  readonly dateIssued: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '2023-08-15T10:10:26.435Z' })
  readonly workStartDate: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '2023-08-15T10:10:26.435Z' })
  readonly workEndDate: string;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 100 })
  readonly absences: number;

  // @JoiSchema(Joi.number().required())
  // @ApiProperty({ example: 100 })
  // readonly consultingCommission: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 100 })
  readonly consultingCommissionQuantity: number;

  // @JoiSchema(Joi.number().required())
  // @ApiProperty({ example: 200 })
  // readonly hourlyTeachingRate: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 200 })
  readonly hourlyTeachingRateQuantity: number;

  // @JoiSchema(Joi.number().required())
  // @ApiProperty({ example: 50 })
  // readonly hourlyTutoringRate: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 50 })
  readonly hourlyTutoringRateQuantity: number;

  // @JoiSchema(Joi.number().required())
  // @ApiProperty({ example: 50 })
  // readonly hourlyTAPARate: number;

  @JoiSchema(Joi.number().required())
  @ApiProperty({ example: 50 })
  readonly hourlyTAPARateQuantity: number;

  // @JoiSchema(Joi.number().required())
  // @ApiProperty({ example: 32 })
  // readonly insuranceAmount: number;

  // @JoiSchema(Joi.number().required())
  // @ApiProperty({ example: 10.5 })
  // readonly employeePay: number;

  // @JoiSchema(Joi.number().required())
  // @ApiProperty({ example: 21.5 })
  // readonly companyPay: number;
}
