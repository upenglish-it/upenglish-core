import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts } from '.';
import { Courses } from '../courses';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'accounts-courses' } })
export class AccountsCourses {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;

  // associated to parent collection
  // assigned instructor
  @Prop({ ref: () => Accounts, type: String, required: true })
  public instructor: Accounts;

  // assigned student
  @Prop({ ref: () => Accounts, type: String, required: true })
  public student: Accounts;

  // assigned courses
  @Prop({ ref: () => Courses, type: String, required: true })
  public courses: Courses;
}
