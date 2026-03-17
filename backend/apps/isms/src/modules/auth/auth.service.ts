// NestJs imports
import { DateTime } from 'luxon';
import { isEmpty } from 'lodash';
import { InjectModel } from 'nestjs-typegoose';
import { ReturnModelType } from '@typegoose/typegoose';
import { forwardRef, HttpStatus, Inject, Injectable } from '@nestjs/common';
// Dto's
import { AuthSignInDTO, CreateAccountDTO } from './dto';
// Modules
import { AccountsService } from '../accounts/accounts.service';
// Commons
import {
  GENERATE_AUTHORIZATION_TOKEN,
  IResponseHandlerParams,
  MicrosoftGenerateRedirectURI,
  MicrosoftGetToken,
  MicrosoftUserInfo,
  ResponseHandlerService,
  Accounts,
  STATUS_CODE,
  GoogleAuthRedirect,
} from 'apps/common';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
    @Inject(forwardRef(() => AccountsService)) private readonly accountsService: AccountsService
    // @InjectModel(StudentsTuitionAttendance) private readonly studentsTuitionAttendance: ReturnModelType<typeof StudentsTuitionAttendance>
  ) {}

  public async socialAuthorization(query: { code: string; stage: string; session_state: string }, request: Request): Promise<IResponseHandlerParams> {
    try {
      const getToken = await MicrosoftGetToken({
        code: query.code,
        grant_type: 'authorization_code',
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET_VALUE,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URL,
      });

      if (!getToken) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          message: `Unable to request the access token in microsoft.`,
        });
      }

      const authToken = `${getToken.token_type} ${getToken.access_token}`;
      const userInfo = await MicrosoftUserInfo(authToken);

      console.log('getToken >>> ', getToken, 'userInfo ', userInfo);

      // const email = userInfo?.mail || userInfo?.userPrincipalName;

      // const email = 'huynhquan.nguyen@upenglishvietnam.com'; // admin in dev
      // const email = 'thaopham@upenglishvietnam.com'; // receptionist in dev
      // const email = 'nhanvo@upenglishvietnam.com'; // teacher in dev
      const email = 'abc@gmail.com'; // student in dev

      // const email = 'ngocnguyen@upenglishvietnam.com'; // teacher in prod
      // const email = 'studentco@upenglishvietnam.com';
      // const email = 'UPAdmin@upenglishvietnam.com';
      // const email = 'UPStudent@upenglishvietnam.com';
      // const email = 'UPTeacher@upenglishvietnam.com';
      // const email = 'upmarketing@upenglishvietnam.com';
      // const email = 'UPAccounting@upenglishvietnam.com';
      // const email = 'kimngocnguyen@upenglishvietnam.com';
      // const email = 'dattran@upenglishvietnam.com';

      const account = await this.accounts.findOne({
        $or: [{ emailAddresses: email.toLocaleLowerCase() }],
      });

      // console.log('account', account);

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Account does not exist. Please contact the administrator',
        });
      }

      const accountInfo = await this.accountsService.accountInfo(account._id);
      // console.log('accountInfo', JSON.stringify(accountInfo, null, 2));
      const propertyId = accountInfo.properties[0]._id;

      const branchId = accountInfo.properties[0].propertiesBranches[0]._id;

      /* check if student has a class which is not paid */
      // if (account.role === 'student') {
      //   const studentsTuitionAttendance = await this.studentsTuitionAttendance.find({
      //     student: account._id,
      //     properties: propertyId,
      //     status: 'ongoing',
      //     deleted: false,
      //   });

      //   if (!isEmpty(studentsTuitionAttendance)) {
      //     const totalOfUnpaidDays = studentsTuitionAttendance.reduce((pv, cv) => {
      //       const unPaidDays = cv.records.filter((r) => !r.paid).length;
      //       return pv + unPaidDays;
      //     }, 0);

      //     console.log('totalOfUnpaidDays', totalOfUnpaidDays);

      //     if (totalOfUnpaidDays > 0) {
      //       return ResponseHandlerService({
      //         success: false,
      //         httpCode: HttpStatus.UNAUTHORIZED,
      //         message: `Unable to access your account. Please contact the admin.`,
      //       });
      //     }
      //   }
      // }

      if (account.role === 'student' && !account.active) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          message: `Unable to access your account. Please contact the admin.`,
        });
      }

      const composeAuthorizationToken = GENERATE_AUTHORIZATION_TOKEN({
        payload: {
          accountId: account._id,
          propertyId: propertyId,
          branchId: branchId,
          queryIds: {
            propertyId: propertyId,
            branchId: branchId,
          },
        },
        device: {
          source: request.headers['user-agent'],
        },
        interval: {
          expireAt: DateTime.now()
            .plus({
              hours: 24,
            })
            .toISO(),
        },
      });

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          authorizationToken: composeAuthorizationToken,
          selectedBranch: branchId,
          ...accountInfo,
        },
      });
    } catch (error) {
      console.log('error', error);
      return ResponseHandlerService({
        success: false,
        httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
        statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
        message: 'Unable to process your data',
        errorDetails: error,
      });
    }
  }

  public async signIn(body: AuthSignInDTO, request: Request): Promise<IResponseHandlerParams> {
    try {
      if (body.provider === 'email-password') {
        const account = await this.accounts.findOne({
          $or: [{ emailAddresses: body.emailAddress }],
        });

        if (isEmpty(account)) {
          return ResponseHandlerService({
            success: false,
            httpCode: HttpStatus.NOT_FOUND,
            statusCode: STATUS_CODE.NOT_FOUND,
            message: 'Incorrect email address or password',
          });
        }

        // Check if password is matched
        // const passwordMatched = await PASSWORD_MATCHED(body.password, );
        // if (!passwordMatched) {
        //   return ResponseHandlerService({
        //     success: false,
        //     httpCode: HttpStatus.NOT_ACCEPTABLE,
        //     statusCode: STATUS_CODE.REQUEST_DENIED,
        //     message: 'Password does not matched',
        //   });
        // }

        const accountInfo = await this.accountsService.accountInfo(account._id);

        const composeAuthorizationToken = GENERATE_AUTHORIZATION_TOKEN({
          // expiration: '',
          // requestHeaders: {
          //   'user-agent': request.headers['user-agent'],
          // } as any,
          // data: {
          //   accountId: account._id,
          //   propertyId: accountInfo.properties[0].properties._id,
          //   branchId: accountInfo.properties[0].properties.propertiesBranches[0]._id,
          // },

          payload: {
            accountId: account._id,
            propertyId: accountInfo.properties[0].properties._id,
            branchId: accountInfo.properties[0].properties.propertiesBranches[0]._id,
            queryIds: {
              propertyId: accountInfo.properties[0].properties._id,
              branchId: accountInfo.properties[0].properties.propertiesBranches[0]._id,
            },
          },
          device: {
            source: request.headers['user-agent'],
          },
          interval: {
            expireAt: DateTime.now().plus({ hours: 24 }).toISO(),
          },
        });

        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.HAS_DATA,
          data: {
            authorizationToken: composeAuthorizationToken,
            ...accountInfo,
          },
        });
      }

      if (body.provider === 'microsoft') {
        const redirectURI = MicrosoftGenerateRedirectURI({ name: 'John ode' });
        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.HAS_DATA,
          data: {
            redirectURI: redirectURI,
          },
        });
      }

      if (body.provider === 'google') {
        const redirectURI = GoogleAuthRedirect({ name: 'John ode' });
        return ResponseHandlerService({
          success: true,
          httpCode: HttpStatus.OK,
          statusCode: STATUS_CODE.HAS_DATA,
          data: {
            redirectURI: redirectURI,
          },
        });
      }
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

  public async create(body: CreateAccountDTO): Promise<IResponseHandlerParams> {
    // try {
    //   // Check if email is already exists
    //   const isEmailExist = await this.accounts.findOne({
    //     'emailAddresses.value': body.emailAddress,
    //   });

    //   if (!isEmpty(isEmailExist)) {
    //     return ResponseHandlerService({
    //       success: false,
    //       httpCode: HttpStatus.CONFLICT,
    //       statusCode: STATUS_CODE.ALREADY_EXISTS,
    //       message: 'Email address is already exists',
    //     });
    //   }

    //   // Create account
    //   const hashedPassword = await PASSWORD_HASHER(body.password);

    //   const createdAccount = await this.accounts.create({
    //     firstName: body.firstName,
    //     lastName: body.lastName,
    //     emailAddresses: [
    //       {
    //         verified: false,
    //         primary: true,
    //         value: body.emailAddress,
    //       },
    //     ],
    //     password: hashedPassword,
    //     profilePhoto: 'default.png',
    //     verified: false,
    //     planId: body.planId,
    //   });

    //   const academics = body.academics.map((a) => {
    //     return {
    //       name: a.name,
    //       qualifications: a.qualification,
    //       price: a.price,
    //       account: createdAccount._id,
    //     };
    //   });

    //   await this.academics.insertMany(academics);

    //   // Generate verification
    //   const fullName = `${body.firstName} ${body.lastName}`;
    //   const verificationCode = CODE_GENERATOR(CODE_COUNT);

    //   // Generate verification token
    //   const verificationToken = NodeRSAEncryptService(
    //     VERIFICATION_TOKEN_DATA({
    //       code: verificationCode,
    //       type: 'email',
    //       purpose: 'signup',
    //       accountId: createdAccount._id,
    //       value: body.emailAddress,
    //       fullName: fullName,
    //     }),
    //   );

    //   // Save verification token
    //   await this.verificationLogs.create({
    //     accountId: createdAccount._id,
    //     token: verificationToken,
    //   });

    //   // Setup MailerSend
    //   const mailerSend = new MailerSend({
    //     api_key: process.env.MAILERSEND_API_TOKEN,
    //   });
    //   const recipients = [new Recipient(body.emailAddress, fullName)];
    //   const mailerSendParams = new EmailParams()
    //     .setFrom('noreply@kaduoco.com')
    //     .setFromName('All Online Tutorials')
    //     .setRecipients(recipients)
    //     .setReplyTo('noreply@allonlinetutorials.com')
    //     .setReplyToName('AOT Team');

    //   // Send email verification
    //   const sendEmailVerificationParams = mailerSendParams;
    //   sendEmailVerificationParams
    //     .setTemplateId(process.env.MAILERSEND_EMAIL_VERIFICATION_TEMPLATE_ID)
    //     .setVariables([
    //       {
    //         email: body.emailAddress,
    //         substitutions: [
    //           {
    //             var: 'code',
    //             value: verificationCode,
    //           },
    //           {
    //             var: 'fullname',
    //             value: fullName,
    //           },
    //         ],
    //       },
    //     ])
    //     .setSubject('You email verification code');
    //   // mailerSend.send(sendEmailVerificationParams); // disable for now para makatipid

    //   // Send welcome email
    //   const sendWelcomeParams = mailerSendParams;
    //   sendWelcomeParams
    //     .setTemplateId(process.env.MAILERSEND_WELCOME_TEMPLATE_ID)
    //     .setVariables([
    //       {
    //         email: body.emailAddress,
    //         substitutions: [
    //           {
    //             var: 'fullname',
    //             value: fullName,
    //           },
    //         ],
    //       },
    //     ])
    //     .setSubject('Welcome to Kaduoco');
    //   // mailerSend.send(sendWelcomeParams); // disable for now para makatipid

    //   return ResponseHandlerService({
    //     success: true,
    //     httpCode: HttpStatus.CREATED,
    //     statusCode: STATUS_CODE.DATA_CREATED,
    //     message: 'Account was created',
    //     data: {
    //       emailAddress: body.emailAddress,
    //       verificationToken: verificationToken,
    //     },
    //   });
    // } catch (error) {
    return ResponseHandlerService({
      success: false,
      httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
      statusCode: STATUS_CODE.INTERNAL_SERVER_ERROR,
      message: 'Unable to process your data',
      // errorDetails: error,
    });
    // }
  }

  public async generateTokenByEmail(emailAddress: string, request: Request): Promise<IResponseHandlerParams> {
    try {
      console.log('emailAddress', emailAddress);
      const account = await this.accounts.findOne({
        emailAddresses: { $in: [emailAddress.trim()] },
      });

      if (isEmpty(account)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.NOT_FOUND,
          statusCode: STATUS_CODE.NOT_FOUND,
          message: 'Incorrect email address or password',
        });
      }

      const accountInfo = await this.accountsService.accountInfo(account._id);

      console.log('accountInfo', JSON.stringify(accountInfo, null, 2));

      const propertyId = accountInfo.properties[0]._id;

      let branchId = accountInfo.properties[0];
      if (account.selectedBranch) {
        branchId = accountInfo.properties[0].propertiesBranches.find((b) => b._id === account.selectedBranch)?._id || null;
      }

      if (account.role === 'student' && !account.active) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNAUTHORIZED,
          message: `Unable to access your account. Please contact the admin.`,
        });
      }

      if (isEmpty(branchId)) {
        return ResponseHandlerService({
          success: false,
          httpCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: `Branch is not yet setted. Please reselect a branch to activate it.`,
        });
      }

      const tokenData = {
        payload: {
          accountId: account._id,
          propertyId: propertyId,
          branchId: branchId,
          queryIds: {
            propertyId: propertyId,
            branchId: branchId,
          },
        },
        device: {
          source: request.headers['user-agent'],
        },
        interval: {
          expireAt: DateTime.now().plus({ hours: 24 }).toISO(),
        },
      };

      console.log('tokenData >> ', tokenData);

      const composeAuthorizationToken = GENERATE_AUTHORIZATION_TOKEN(tokenData);

      return ResponseHandlerService({
        success: true,
        httpCode: HttpStatus.OK,
        statusCode: STATUS_CODE.HAS_DATA,
        data: {
          authorizationToken: composeAuthorizationToken,
          selectedBranch: branchId,
          ...accountInfo,
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
}
