import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';

export class FetchAccountInformationDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Juan' })
  readonly token: string;
}

export class CreateAccountDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'University Of Caloocan City' })
  readonly propertyName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'South' })
  readonly branchName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Juan' })
  readonly firstName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Dela Cruz' })
  readonly lastName: string;

  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'johndoe@yopmail.com' })
  readonly emailAddress: string;

  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: '9494943413' })
  readonly contactNumber: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1234567890' })
  readonly password?: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1234567890' })
  readonly confirmPassword?: string;
}

export class UpdateAccountDTO {
  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Juan' })
  readonly firstName: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Dela Cruz' })
  readonly lastName: string;

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: '1234567890' })
  readonly profilePhoto: string;
}
