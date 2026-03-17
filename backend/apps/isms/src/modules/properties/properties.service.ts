import { HttpStatus, Injectable } from '@nestjs/common';
import { CreatePropertyDTO } from './dto';
import { IResponseHandlerParams, PASSWORD_HASHER, ResponseHandlerService, Accounts, Properties, PropertiesBranches, STATUS_CODE } from 'apps/common';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { isEmpty } from 'lodash';
import { nanoid } from 'nanoid';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(Properties) private readonly properties: ReturnModelType<typeof Properties>,
    @InjectModel(PropertiesBranches) private readonly propertiesBranches: ReturnModelType<typeof PropertiesBranches>,
  ) {}

  public async create(body: CreatePropertyDTO): Promise<IResponseHandlerParams> {
    try {
      // Check if property name is already exists
      const isPropertyExist = await this.properties.findOne({
        name: body.propertyName,
      });
      if (!isEmpty(isPropertyExist)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.CONFLICT,
          statusCode: STATUS_CODE.ALREADY_EXISTS,
          message: 'Property name is already exists',
        });
      }

      // Check if email is already exists
      const isEmailExist = await this.accounts.findOne({
        'emailAddresses.value': body.emailAddress,
      });
      if (!isEmpty(isEmailExist)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.CONFLICT,
          statusCode: STATUS_CODE.ALREADY_EXISTS,
          message: 'Email address is already exists',
        });
      }

      // Create account
      const hashedPassword = await PASSWORD_HASHER(nanoid()); // temporary password so it wont be null
      const createdAccount = await this.accounts.create({
        firstName: body.firstName,
        lastName: body.lastName,
        emailAddresses: [
          {
            verified: false,
            primary: true,
            value: body.emailAddress,
          },
        ],
        baseRole: 'customer',
        password: hashedPassword,
        profilePhoto: 'default.png',
      });
      // TODO: Send a verify link and set password on that link.

      // Create organization
      const createdOProperty = await this.properties.create({
        name: body.propertyName,
      });
      // TODO: Send an welcome email for the created organization

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Property was created',
        data: { createdOProperty, createdAccount },
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
