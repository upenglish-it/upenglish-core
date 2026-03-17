import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import {} from 'apps/common';

export class CreateAccountDTO {
  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1' })
  readonly planId: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({
    example: [
      {
        name: 'Astronomy',
        qualification: '',
        price: '10',
      },
    ],
  })
  readonly academics: Array<ISubjects>;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Juan' })
  readonly firstName: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: 'Dela Cruz' })
  readonly lastName: string;

  @JoiSchema(Joi.string().email().required())
  @ApiProperty({ example: 'johndoe@yopmail.com' })
  readonly emailAddress: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1234567890' })
  readonly password: string;

  @JoiSchema(Joi.string().required())
  @ApiProperty({ example: '1234567890' })
  readonly confirmPassword: string;
}

interface ISubjects {
  name: string;
  qualification: string;
  price: string;
}
