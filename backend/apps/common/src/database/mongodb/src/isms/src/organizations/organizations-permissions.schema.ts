import { Prop, modelOptions } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'organizations-permissions' } })
export class OrganizationsPermissions {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  _id: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

// export interface IALGNBranchAvailability {
//   day: string;
//   hours: Array<IALGNBranchAvailabilityHour>;
// }
// export interface IALGNBranchAvailabilityHour {
//   from: string;
//   to: string;
// }

// export interface IALGNBranchMember {
//   id: string;
//   creator: boolean;
//   role: TALGNBranchMemberRole;
//   dateAdded: string;
// }

// export type TALGNBranchMemberRole = 'admin' | 'view';
