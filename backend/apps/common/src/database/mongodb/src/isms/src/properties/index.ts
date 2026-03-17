import { Prop, modelOptions, Ref } from '@typegoose/typegoose';
import { PropertiesBranches } from './branches';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'properties' } })
export class Properties {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  _id: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
  // /**
  //  * @verified identifier if the account is legit
  //  * */
  // @Prop({ type: Boolean, required: true, default: false })
  // verified: boolean;

  // @Prop({ type: Array, required: true })
  // members: Array<IALGNPropertyMember>;

  @Prop({
    ref: () => PropertiesBranches,
    foreignField: 'properties',
    localField: '_id',
    // justOne: true,//
  })
  public propertiesBranches: Array<PropertiesBranches>; //Ref<ALGNBranches>[];
}

// export interface IALGNPropertyMember {
//   id: string;
//   creator: boolean;
//   role: TALGNPropertyMemberRole;
//   dateAdded: string;
// }

// export type TALGNPropertyMemberRole = 'admin' | 'view';
