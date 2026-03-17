import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateAccountDTO, UpdateAccountDTO } from './dto';
import {
  IResponseHandlerParams,
  PredefinedRole,
  ResponseHandlerService,
  RoleAndPermission,
  Accounts,
  AccountsProperties,
  AccountsRoles,
  Properties,
  PropertiesBranches,
  RolesPermissions,
  VerificationLogs,
  STATUS_CODE,
  IAuthTokenPayload,
  ACCOUNT_ID,
  NOTIFICATION_DEFAULT_VALUE,
} from 'apps/common';
import { ReturnModelType } from '@typegoose/typegoose';
import { InjectModel } from 'nestjs-typegoose';
import { isEmpty } from 'lodash';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @InjectModel(AccountsProperties) private readonly accountsProperties: ReturnModelType<typeof AccountsProperties>,
    @InjectModel(AccountsRoles) private readonly accountsRoles: ReturnModelType<typeof AccountsRoles>,
    @InjectModel(VerificationLogs) private readonly verificationLogs: ReturnModelType<typeof VerificationLogs>,
    @InjectModel(RolesPermissions) private readonly rolesPermissions: ReturnModelType<typeof RolesPermissions>,
    @InjectModel(Properties) private readonly properties: ReturnModelType<typeof Properties>,
    @InjectModel(PropertiesBranches) private readonly propertiesBranches: ReturnModelType<typeof PropertiesBranches>
  ) {}

  public async createCustomer(body: CreateAccountDTO): Promise<IResponseHandlerParams> {
    try {
      /* Check if email is already exist */
      const isEmailExist = await this.accounts.find({
        emailAddresses: { $in: [body.emailAddress.toLocaleLowerCase()] },
      });
      if (!isEmpty(isEmailExist)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.CONFLICT,
          statusCode: STATUS_CODE.ALREADY_EXISTS,
          message: 'Email address is already exist',
        });
      }

      /** Save property  */
      const createdProperty = await this.properties.create({
        name: body.propertyName,
      });

      /** Save property branch  */
      const createdPropertyBranch = await this.propertiesBranches.create({
        name: body.branchName,
        properties: createdProperty._id,
        primary: true,
      });

      /** Save predefined role */
      let assignedRoleId: string = null;
      for await (const role of PredefinedRole) {
        const associatedPermission = RoleAndPermission(role.value);
        const createdRole = await this.rolesPermissions.create({
          name: role.name,
          value: role.value,
          permissions: associatedPermission,
          properties: createdProperty._id,
          propertiesBranches: createdPropertyBranch._id,
        });
        if (role.value === 'admin') {
          assignedRoleId = createdRole._id;
        }
      }

      /** Save customer information */
      /* Create account */
      const accountId = ACCOUNT_ID(`${body.firstName[0]}${body.lastName[0]}`);
      const role = 'admin';

      const createdAccount = await this.accounts.create({
        accountId: accountId,
        firstName: body.firstName,
        lastName: body.lastName,
        emailAddresses: [body.emailAddress.toLocaleLowerCase()],
        contactNumbers: body.contactNumber,
        gender: null,
        birthDate: null,
        address: null,
        tags: [],
        sources: [],
        properties: createdProperty._id,
        propertiesBranches: [createdPropertyBranch._id],
        sourceBranch: createdPropertyBranch._id,
        language: 'en',
        notification: NOTIFICATION_DEFAULT_VALUE(role),
        role: role,
        baseRole: 'customer',
        createdFrom: 'manual',
      });

      /* Save assigned role */
      await this.accountsRoles.create({
        rolesPermissions: assignedRoleId,
        accounts: createdAccount._id,
        properties: createdProperty._id,
        propertiesBranches: createdPropertyBranch._id,
      });

      /* Save property role */
      await this.accountsProperties.create({
        accounts: createdAccount._id,
        properties: createdProperty._id,
        rolesPermissions: assignedRoleId, // role of user in that property
      });

      // Generate verification token
      // const fullName = `${body.firstName} ${body.lastName}`;
      // const verificationCode = CODE_GENERATOR(CODE_COUNT);
      // const verificationToken = NodeRSAEncryptService(
      //   VERIFICATION_TOKEN_DATA({
      //     code: verificationCode,
      //     type: 'email',
      //     purpose: 'signup',
      //     accountId: createdAccount._id,
      //     value: body.emailAddress,
      //     fullName: fullName,
      //   }),
      // );

      // // Save verification token
      // await this.verificationLogs.create({
      //   accountId: createdAccount._id,
      //   token: verificationToken,
      // });

      // Setup MailerSend
      // const mailerSend = new MailerSend({
      //   api_key: process.env.MAILERSEND_API_TOKEN,
      // });
      // const recipients = [new Recipient(body.emailAddress, fullName)];
      // const mailerSendParams = new EmailParams()
      //   .setFrom('noreply@kaduoco.com')
      //   .setFromName('All Online Tutorials')
      //   .setRecipients(recipients)
      //   .setReplyTo('noreply@allonlinetutorials.com')
      //   .setReplyToName('AOT Team');

      // // Send email verification
      // const sendEmailVerificationParams = mailerSendParams;
      // sendEmailVerificationParams
      //   .setTemplateId(process.env.MAILERSEND_EMAIL_VERIFICATION_TEMPLATE_ID)
      //   .setVariables([
      //     {
      //       email: body.emailAddress,
      //       substitutions: [
      //         {
      //           var: 'code',
      //           value: verificationCode,
      //         },
      //         {
      //           var: 'fullname',
      //           value: fullName,
      //         },
      //       ],
      //     },
      //   ])
      //   .setSubject('You email verification code');
      // // mailerSend.send(sendEmailVerificationParams); // disable for now para makatipid

      // // Send welcome email
      // const sendWelcomeParams = mailerSendParams;
      // sendWelcomeParams
      //   .setTemplateId(process.env.MAILERSEND_WELCOME_TEMPLATE_ID)
      //   .setVariables([
      //     {
      //       email: body.emailAddress,
      //       substitutions: [
      //         {
      //           var: 'fullname',
      //           value: fullName,
      //         },
      //       ],
      //     },
      //   ])
      //   .setSubject('Welcome to Kaduoco');
      // // mailerSend.send(sendWelcomeParams); // disable for now para makatipid

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.CREATED,
        statusCode: STATUS_CODE.DATA_CREATED,
        message: 'Account was created',
        data: {
          emailAddress: body.emailAddress,
          // verificationToken: verificationToken,
        },
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

  public async fetchInformation(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      console.log('fetchInformation', tokenPayload);
      const account = await this.accountInfo(tokenPayload.accountId);
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          ...account,
          selectedBranch: tokenPayload.branchId,
        },
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

  public async updateById(body: UpdateAccountDTO, tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
    try {
      await this.accounts.findOneAndUpdate(
        { _id: tokenPayload.accountId },
        {
          firstName: body.firstName,
          lastName: body.lastName,
          profilePhoto: body.profilePhoto,
        }
      );
      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
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

  public async accountInfo(accountId: string): Promise<any> {
    /* account */

    console.log('accountInfo 1');
    const account = await this.accounts
      .findOne({ _id: accountId }, { password: 0 })
      // .populate([
      //   {
      //     path: 'guardians',
      //     model: Guardians as any,
      //     options: { sort: { createdAt: -1 } },
      //   },
      // ])
      .lean();

    const accountJSON = account; //.toJSON();
    console.log('accountInfo 2');

    /* property */
    // const property = await this.pro.findOne({ accounts: accountId });

    /* role */
    const accountRoles = await this.accountsRoles
      .find({ accounts: accountId }, {})
      .populate([
        {
          path: 'rolesPermissions',
          model: RolesPermissions as any,
          options: { sort: { createdAt: -1 } },
        },
      ])
      .lean();

    console.log('accountInfo 3');

    /* role is superadmin or admin */
    // const isSuperAdminOrAdmin = role.find((r) => r.roles.value === 'superadmin' || r.roles.value === 'admin');
    // if (!isEmpty(isSuperAdminOrAdmin || role.length > 2)) {
    const accountRole = accountRoles[0];

    console.log('accountInfo 4.1');

    // }

    // /* role */
    // const properties = await this.accountsProperties
    //   .find({ accounts: account._id }, {})
    //   .populate([
    //     {
    //       path: 'properties',
    //       model: Properties as any,
    //       options: { sort: { createdAt: -1 } },
    //       populate: {
    //         path: 'propertiesBranches',
    //         model: PropertiesBranches as any,
    //         options: { sort: { createdAt: -1 } },
    //       },
    //     },
    //   ])
    //   .lean();
    // console.log('account._id', account._id);
    const properties = await this.accountsProperties.aggregate([
      {
        $match: {
          accounts: account._id,
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'properties',
          foreignField: '_id',
          as: 'properties',
          pipeline: [
            {
              $sort: { createdAt: -1 },
            },
            {
              $lookup: {
                from: 'properties-branches',
                as: 'propertiesBranches',
                pipeline: [
                  {
                    $match: {
                      // _id: account.propertiesBranches,
                      _id: {
                        $in: account.propertiesBranches,
                      },
                    },
                  },
                  {
                    $sort: { createdAt: -1 },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    console.log('accountInfo 4');

    return {
      account: accountJSON,
      rolePermission: accountRole,
      properties: properties[0].properties,
    };
  }
}
