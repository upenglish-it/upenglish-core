import { Prop, modelOptions } from '@typegoose/typegoose';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'migration-data' } })
export class MigrationData {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: true })
  public type: 'tuition' | 'attendance';

  @Prop({ type: Object, required: true })
  public data: any;
}
