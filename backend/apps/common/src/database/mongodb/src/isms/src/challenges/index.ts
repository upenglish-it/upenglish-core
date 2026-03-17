// import { Prop, modelOptions } from '@typegoose/typegoose';
// import { Accounts } from '../accounts';
// import { Properties } from '../properties';
// import { PropertiesBranches } from '../properties/branches';
// import { ChallengesAttendeeResponses } from './attendee-reponses';
// import { SYSTEM_ID } from 'apps/common/src/utils';

// @modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'challenges' } })
// export class Challenges {
//   @Prop({
//     type: String,
//     default: () => SYSTEM_ID(),
//   })
//   public _id: string;

//   @Prop({ type: String, required: true })
//   public title: string;

//   @Prop({ type: Number, required: true })
//   public duration: number;

//   @Prop({ type: Number, required: true })
//   public passing: number;

//   @Prop({ type: Array, default: [] })
//   public categories: Array<ChallengesCategories>;

//   // @Prop({ type: Array, required: true })
//   // public attendeeAnswers: Array<{
//   //   questionId: string;
//   //   answer: string;
//   // }>;

//   @Prop({ type: Boolean, default: false })
//   public publish: boolean;

//   @Prop({ type: String, required: true })
//   public startDate: string;

//   @Prop({ type: String, required: true })
//   public endDate: string;

//   @Prop({ ref: () => Accounts, type: Array, default: [] })
//   public participants: Array<Accounts>;

//   @Prop({ ref: () => Accounts, type: String, required: true })
//   public createdBy: Accounts;

//   @Prop({ ref: () => Properties, type: String, required: true })
//   public properties: Properties;

//   @Prop({ ref: () => PropertiesBranches, type: String, required: true })
//   public propertiesBranches: PropertiesBranches;

//   @Prop({ type: Boolean, required: false, default: false })
//   public deleted: boolean;

//   @Prop({
//     ref: () => ChallengesAttendeeResponses,
//     foreignField: 'challenge._id',
//     localField: '_id',
//   })
//   public attendeeResponses: Array<ChallengesAttendeeResponses>;
// }

// export interface ChallengesCategories {
//   id: string;
//   title: string;
//   questions: Array<ChallengesQuestion>;
// }

// export interface ChallengesQuestion {
//   id: string;
//   title: string;
//   description: string;
//   type: 'choices' | 'fill-in';
//   choices: Array<ChallengesQuestionChoice>;
//   fillIn: string;
//   originalAnswer: string;
//   attendeeAnswer: string;
// }

// interface ChallengesQuestionChoice {
//   id: string;
//   value: string;
// }
