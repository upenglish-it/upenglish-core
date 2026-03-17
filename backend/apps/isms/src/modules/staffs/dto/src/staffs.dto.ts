import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { IAddress, IContactNumber, TRole } from 'apps/common';

export class CreateStaffDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Juan' })
  readonly firstName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Dela Cruz' })
  readonly lastName: string;

  @JoiSchema(Joi.array().items(Joi.string().email().required()).required())
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

  @JoiSchema(Joi.string().valid('male', 'female').required())
  @ApiProperty({ example: 'male' })
  readonly gender: string;

  @JoiSchema(Joi.date().required())
  @ApiProperty({ example: 'male' })
  readonly birthDate: string;

  @JoiSchema(Joi.string().allow(null))
  @ApiProperty({ example: 'en' })
  readonly language: string;

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

  @JoiSchema(Joi.string().valid('manual', 'csv').required())
  @ApiProperty({ example: 'csv' })
  readonly createdFrom: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'marketing' })
  readonly role: TRole;
}

export class FetchStaffsDTO {
  @JoiSchema(Joi.number().optional())
  @ApiProperty({ example: 10 })
  readonly limit: number;

  @JoiSchema(Joi.number().optional())
  @ApiProperty({ example: 10 })
  readonly skip: number;

  @JoiSchema(Joi.number().optional())
  @ApiProperty({ example: 1 })
  readonly active: number;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'John' })
  readonly name: string;

  @JoiSchema(Joi.boolean().optional())
  @ApiProperty({ example: false })
  readonly includeMe: boolean;
}
