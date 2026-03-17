import { Prop, Severity, modelOptions } from '@typegoose/typegoose';
import { Properties } from '../properties';
import { PropertiesBranches } from '../properties/branches';
import { SYSTEM_ID } from 'apps/common/src/utils';
import { Accounts } from '../accounts';

@modelOptions({
  schemaOptions: { timestamps: true, versionKey: false, collection: 'pipelines' },
  options: { allowMixed: Severity.ALLOW },
})
export class Pipelines {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public readonly _id: string;

  @Prop({ type: Object, required: true })
  public readonly details: {
    title: string;
  };

  @Prop({ type: Object, default: null })
  public readonly sourcingTeam: {
    ownerId: string;
    participantIds: Array<string>;
  };

  @Prop({ type: Object, default: null })
  public readonly sourcingPipeline: {
    stages: Array<PipelineStage>;
  };

  @Prop({ type: Array, default: [] })
  public readonly items: (PipelineLeadsItemI | PipelineTasksItemI)[];

  @Prop({ type: String, default: 'inactive' })
  public readonly status: 'active' | 'inactive';

  @Prop({ type: String, required: true })
  public readonly type: 'leads' | 'task';

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, default: false })
  public readonly deleted: boolean;
}

export interface PipelineStage {
  order: number;
  state: 'start' | 'mid' | 'end';
  type: 'inprogress' | 'completed';
  title: string;
  color: string;
  id: string;
  editable: boolean;
  won: boolean;
}

export interface PipelineLeadsItemI {
  id: string;
  pipelineStageId: string;
  disqualification: {
    disqualified: boolean;
    reason: string;
  };
  order: number;
  addedAt: string;
  addedBy: string;
  info?: Accounts; // added in FE
}
export interface PipelineTasksItemI {
  /** Unique task id (for move/delete). New tasks get this on add. */
  taskId?: string;
  /** Stage id this task belongs to (used for grouping in fetch). */
  id: string;
  name?: string;
  notes?: string;
}
