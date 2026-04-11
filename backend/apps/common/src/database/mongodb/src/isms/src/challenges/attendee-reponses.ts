// import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
// import { Accounts } from '../accounts';
// import { Properties } from '../properties';
// import { PropertiesBranches } from '../properties/branches';
// import { SYSTEM_ID } from 'apps/common/src/utils';

// @modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'challenges-attendee-responses' } })
// export class ChallengesAttendeeResponses {
//   @Prop({
//     type: String,
//     default: () => SYSTEM_ID(),
//   })
//   public _id: string;

//   @Prop({ ref: () => Accounts, type: String, required: true })
//   public to: Accounts;

//   @Prop({ ref: () => Accounts, type: String, required: true })
//   public from: Accounts;

//   // @Prop({ type: Object, required: true })

//   // @Prop({ type: Array, required: true })
//   // public questions: Array<Challenges>;

//   // @Prop({ ref: () => Properties, type: String, required: true })
//   @Prop({ type: Object, required: true })
//   public challenge: any;

//   @Prop({ ref: () => Properties, type: String, required: true })
//   public properties: Properties;

//   @Prop({ ref: () => PropertiesBranches, type: String, required: true })
//   public propertiesBranches: PropertiesBranches;

//   @Prop({ type: Boolean, required: false, default: false })
//   public deleted: boolean;
// }
