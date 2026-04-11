import { Prop, modelOptions, Severity } from '@typegoose/typegoose';
import { Properties } from '..';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ options: { allowMixed: Severity.ALLOW }, schemaOptions: { timestamps: true, versionKey: false, collection: 'properties-branches' } })
export class PropertiesBranches {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  _id: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: false, default: false })
  primary: boolean;

  // @Prop({ type: String, required: true })
  // description: string;

  // @Prop({ type: String, required: true })
  // latLng: string;

  @Prop({ type: String })
  address: string;

  // @Prop({ type: String, required: true, default: '' })
  // photo: string;

  // @Prop({ type: String, required: true, default: '' })
  // coverPhoto: string;

  // @Prop({ type: String, required: true, default: '#f1f1f1' })
  // themeColor: string;

  // @Prop({ type: Array, required: true, default: [] })
  // availability: Array<IALGNBranchAvailability>;

  // /**
  //  * @verified identifier if the shop is legit
  //  * */
  // @Prop({ type: Boolean, required: true, default: false })
  // verified: boolean;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  // @Prop({ type: Array, required: true })
  // members: Array<IALGNBranchMember>;

  // associated head
  // @Prop({ ref: () => ALGNProperties, type: String, required: true })
  // public property: ALGNProperties;

  /* associated to parent collection */
  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;
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
