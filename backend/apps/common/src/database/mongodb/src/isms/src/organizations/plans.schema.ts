import { Prop, modelOptions } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'plans' } })
export class Plans {
  @Prop({
    type: String,
    default: () => SYSTEM_ID(),
  })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}
