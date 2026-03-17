import * as Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';
import { ApiProperty } from '@nestjs/swagger';
import { IAddress, IContactNumber, JOI_MESSAGES } from 'apps/common';

export class FetchStudentsDTO {
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

  @JoiSchema(Joi.object().optional())
  @ApiProperty({ example: {} })
  readonly customQuery: any;

  @JoiSchema(Joi.string().allow(null))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly branches: Array<string>;

  @JoiSchema(Joi.number().integer().min(1).optional().label('Page').messages(JOI_MESSAGES))
  @ApiProperty({ example: 1 })
  public readonly page: number;

  @JoiSchema(Joi.string().optional().allow('').label('Sort Field').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'firstName' })
  public readonly sortField: string;

  @JoiSchema(Joi.string().optional().allow('').valid('ascending', 'decending').label('Sort').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'ascending' })
  public readonly sort: string;
}

export class CreateStudentDTO {
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
      }).required()
    )
  )
  @ApiProperty({ example: [{ countryCallingCode: '+63', number: '9282122241' }] })
  readonly contactNumbers: Array<IContactNumber>;

  @JoiSchema(Joi.string().valid('male', 'female').required())
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
      }).required()
    )
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

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Transferred student' })
  readonly additionalNotes: string;

  @JoiSchema(Joi.string().allow(null))
  @ApiProperty({ example: 'en' })
  readonly language: string;

  @JoiSchema(Joi.string().allow(null))
  @ApiProperty({ example: 'en' })
  readonly cmnd: string;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['beginner'] })
  readonly tags: Array<string>;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['facebook'] })
  readonly sources: Array<string>;

  @JoiSchema(Joi.boolean().valid(true, false).required())
  @ApiProperty({ example: false })
  readonly official: boolean;

  @JoiSchema(
    Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        relationship: Joi.string().required(),
        primaryNumber: Joi.string().required(),
        secondaryNumber: Joi.string().required(),
      }).required()
    )
  )
  @ApiProperty({ example: [{ name: 'John', relationship: 'Brother', primaryNumber: '', secondaryNumber: '' }] })
  readonly guardians: Array<{ name: string; relationship: string; primaryNumber: string; secondaryNumber: string }>;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly branches: Array<string>;

  @JoiSchema(Joi.string().valid('manual', 'csv').required())
  @ApiProperty({ example: 'csv' })
  readonly createdFrom: string;
}

export class UpdateStudentDTO {
  @JoiSchema(Joi.string().allow(null))
  @ApiProperty({ example: 'en' })
  readonly cmnd: string;

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
      }).required()
    )
  )
  @ApiProperty({ example: [{ countryCallingCode: '+63', number: '9282122241' }] })
  readonly contactNumbers: Array<IContactNumber>;

  @JoiSchema(
    Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        relationship: Joi.string().required(),
        primaryNumber: Joi.string().required(),
        secondaryNumber: Joi.string().required(),
      }).required()
    )
  )
  @ApiProperty({ example: [{ name: 'John', relationship: 'Brother', primaryNumber: '', secondaryNumber: '' }] })
  readonly guardians: Array<{ name: string; relationship: string; primaryNumber: string; secondaryNumber: string }>;

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
      }).required()
    )
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

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: 'Student transfer' })
  readonly additionalNotes: string;

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

  @JoiSchema(Joi.string().optional())
  @ApiProperty({ example: '51865ef9-e84e-47cd-af41-bc5014cdf936' })
  readonly assignedTo: string;
}

export class CreateBulkStudentsDTO {
  @JoiSchema(Joi.array().required())
  @ApiProperty({
    example: [
      {
        firstName: 'Ryan',
        lastName: 'Grier',
        emailAddress: 'ryan@nexteleven.solutions',
        contactNumber: '9494943413',
        gender: 'male',
        birthdate: '2023-03-10',
        address: '8 Michener Lane, Trabuco Canyon, CA 80104, United States',
      },
    ],
  })
  readonly records: Array<any>;
}

export class AddTagsStudentsDTO {
  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly studentIds: Array<string>;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['late-registered'] })
  readonly tags: Array<string>;
}

export class AddSourcesStudentsDTO {
  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['51865ef9-e84e-47cd-af41-bc5014cdf936'] })
  readonly studentIds: Array<string>;

  @JoiSchema(Joi.array().items(Joi.string().optional()))
  @ApiProperty({ example: ['late-registered'] })
  readonly sources: Array<string>;
}

export class ManageStudentsDTO {
  @JoiSchema(Joi.string().required().label('Pipeline stage Id').messages(JOI_MESSAGES))
  @ApiProperty({ example: 'delete' })
  public readonly action:
    | 'lead-info'
    | 'delete'
    | 'add-tag'
    | 'send-email'
    | 'add-task'
    | 'disqualify'
    | 'requalify'
    | 'add-to-pipeline-with-pipeline-stage'
    | 'remove-from-pipeline-with-pipeline-stage'
    | 'remove-from-pipelines'
    | 'add-to-pipelines'
    | 'add-source';

  @JoiSchema(Joi.object().optional().label('Job Id').messages(JOI_MESSAGES))
  @ApiProperty({
    example: {
      pipelineIds: ['HC51301a4b202d40c6ae95cbb5a76250a2'],
      pipelineStageId: 'HC51301a4b202d40c6ae95cbb5a76250a2',
    },
    description:
      '@pipelineIds use to add in multiple pipeline and lead will added in applied stage by default. @pipelineId use to add lead in specific pipeline and stage',
  })
  public readonly pipeline: {
    pipelineIds: Array<string>;
    pipelineStageId?: string;
  };

  @JoiSchema(Joi.array().items(Joi.string()).required().label('Student Ids').messages(JOI_MESSAGES))
  @ApiProperty({ example: ['HC51301a4b202d40c6ae95cbb5a76250a2'] })
  public readonly leadIds: Array<string>;
}
