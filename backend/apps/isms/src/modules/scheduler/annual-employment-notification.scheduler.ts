// import { HttpStatus, Inject, forwardRef } from '@nestjs/common';
// // import { ResponseHandlerService } from 'apps/common/services';
// // import { ActionStatus } from 'apps/common/constants';
// // import { AutomationOfCandidateExecuteProcessAction, IResponseHandlerParams } from 'apps/common/interfaces';
// import { InjectQueue } from 'agenda-nest';
// import { Queue } from 'agenda-nest';
// import Agenda, { Job } from 'agenda';
// import { DateTime } from 'luxon';
// import { Accounts, IResponseHandlerParams, ResponseHandlerService } from 'apps/common';
// import { ReturnModelType } from '@typegoose/typegoose';
// import { InjectModel } from 'nestjs-typegoose';
// // import { RecruiterAutomationAction } from 'apps/common/databases';
// // import { ExecuteFlow } from './execute.flow';

// @Queue('annual-employment-notification-scheduler')
// export class InactiveAccountScheduler {
//   constructor(
//     @InjectQueue('annual-employment-notification-scheduler') private readonly automationScheduleAction: Agenda,

//     @InjectModel(Accounts) private readonly accounts: ReturnModelType<typeof Accounts>,
//   ) {
//     this.automationScheduleAction.define('annual-employment-notification-scheduler', (job: Job) => this.definedAgenda(job));
//     automationScheduleAction.on('start', (job: Job) => this.startAgenda(job));
//     automationScheduleAction.on('start:annual-employment-notification-scheduler', (job: Job) => this.startAgenda(job));
//     automationScheduleAction.on('success:annual-employment-notification-scheduler', (job: Job) => this.successAgenda(job));
//     automationScheduleAction.on('complete:annual-employment-notification-scheduler', (job: Job) => this.completedAgenda(job));
//     automationScheduleAction.on('fail:annual-employment-notification-scheduler', (err: any, job: Job) => this.failAgenda(err, job));
//   }

//   private startAgenda(job: Job): void {
//     console.log('startAgenda ');
//   }

//   private successAgenda(job: Job): void {
//     console.log('successAgenda ');
//   }

//   private async completedAgenda(job: Job): Promise<void> {
//     job.remove();
//     // console.log('completedAgenda');
//     // await this.agendaNotification.schedule(
//     //   DateTime.now()
//     //     .plus({
//     //       seconds: 3,
//     //     })
//     //     .toJSDate(),
//     //   ['automation-action'],
//     //   job.attrs.data,
//     // );

//     console.log('this ', this);
//     const actionData = job.attrs.data as IActionData;

//     if (actionData.action === 'to-be-inactive') {
//       this.accounts.findOneAndUpdate({ _id: actionData.accountId }, { $set: { active: false } }).then();
//     }
//     // this.executeFlow.processAction({
//     //   actionId: executeProcessActionData.actionId,
//     //   automationOfCandidateId: executeProcessActionData.automationOfCandidateId,
//     // });
//   }

//   private failAgenda(err: any, job: Job): void {
//     console.log('completedAgenda');
//   }

//   private definedAgenda(job: Job): void {
//     console.log('definedAgenda', job.attrs._id);
//   }

//   public async processAction(data: IActionData): Promise<IResponseHandlerParams> {
//     try {
//       const dateTime = DateTime.now().plus({ seconds: 15 }).toJSDate(); // inactive student after 40days

//       await this.automationScheduleAction.schedule(dateTime, 'annual-employment-notification-scheduler', data);

//       return ResponseHandlerService({
//         success: false,
//         httpCode: HttpStatus.BAD_REQUEST,
//         // statusCode: ActionStatus.REQUEST_DENIED,
//         message: 'Request cannot process',
//       });
//     } catch (error) {
//       console.log(error);
//       return ResponseHandlerService({
//         success: false,
//         httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
//         // statusCode: ActionStatus.INTERNAL_SERVER_ERROR,
//         message: 'Unable to process your data',
//         errorDetails: error,
//       });
//     }
//   }

//   // private async sendSMS(tokenPayload: IAuthTokenPayload): Promise<IResponseHandlerParams> {
//   //   try {
//   //     const recipients = ['+639278977591'];

//   //     const params = new SMSParams().setFrom('+18332647501').setTo(recipients).setText('This is the text content');

//   //     await new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY }).sms.send(params);

//   //     return ResponseHandlerService({
//   //       success: false,
//   //       httpCode: HttpStatus.BAD_REQUEST,
//   //       statusCode: ActionStatus.REQUEST_DENIED,
//   //       message: 'Request cannot process',
//   //     });
//   //   } catch (error) {
//   //     console.log(error);
//   //     return ResponseHandlerService({
//   //       success: false,
//   //       httpCode: HttpStatus.INTERNAL_SERVER_ERROR,
//   //       statusCode: ActionStatus.INTERNAL_SERVER_ERROR,
//   //       message: 'Unable to process your data',
//   //       errorDetails: error,
//   //     });
//   //   }
//   // }
// }

// interface IActionData {
//   dateHired: string;
//   accountId: string;
// }
