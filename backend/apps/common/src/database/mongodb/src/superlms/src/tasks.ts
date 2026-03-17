import { Prop, modelOptions } from '@typegoose/typegoose';
import { Accounts, Properties, PropertiesBranches } from '../../isms';
import { SYSTEM_ID } from 'apps/common/src/utils';

@modelOptions({ schemaOptions: { timestamps: true, versionKey: false, collection: 'ielts-tasks' } })
export class IELTSTasks {
  @Prop({ type: String, default: () => SYSTEM_ID() })
  public _id: string;

  @Prop({ type: String, required: true })
  public name: string;

  @Prop({ type: Number, default: 10000 })
  public duration: number;

  @Prop({ type: String, required: true })
  public type: 'reading' | 'writing' | 'listening' | 'speaking';

  @Prop({ type: Number, default: 0 })
  public selectedVariationIndex: number;

  @Prop({ type: Number, default: 0 })
  public selectedPartIndex: number;

  @Prop({ type: Array, required: true })
  public variations: VariationI[];

  @Prop({ type: String, default: null })
  public course: string;

  @Prop({ type: String, default: null })
  public class: string;

  @Prop({ type: String, default: null })
  public submittedDate: string;

  @Prop({ ref: () => Accounts, type: String, required: true })
  public createdBy: Accounts;

  @Prop({ ref: () => Properties, type: String, required: true })
  public properties: Properties;

  @Prop({ ref: () => PropertiesBranches, type: String, required: true })
  public propertiesBranches: PropertiesBranches;

  @Prop({ type: Boolean, required: false, default: false })
  public deleted: boolean;
}

///// Variations /////
export interface VariationI {
  id: string;
  parts: PartI[];
}

///// Parts /////
export interface PartI {
  id: string;
  description: string;
  showLeftPanel: boolean;
  items: ItemI[];
}

///// Items or Questions /////
const ItemsStatusC = [
  'instruction',
  'choice',
  'fill-in',
  'fill-in-input',
  'drag-drop',
  'drag-to-fill',
  'box-ticking',
  'speaking',
  'ielts-writing',
  'ielts-speaking',
] as const;
export type ItemType = (typeof ItemsStatusC)[number];
export interface ItemI {
  id: string;
  title: string;
  description: string;
  points: number; //--- total points of the question
  score: number; //--- score of the answer of participant
  reviewed: boolean; //--- whether the answer has been reviewed
  type: ItemType;
  itemNumber: string;
  aiPrompt: {
    _id: string;
    name: string;
    provider: 'openrouter' | 'gemini' | 'openai';
    model: string;
    apiKey: string;
    message: string;
  };

  participantAnswer?: any;
  reviewerAnswer?: any;
  originalAnswer?: any;
  choices?: ChoiceItem[];
  fillIn?: string;
  dragDrop?: DragDropItemI[];
  speaking?: string;
  ieltsWriting?: string;
  ieltsWritingResult?: {
    taskResponseBand: number;
    coherenceCohesionBand: number;
    lexicalResourceBand: number;
    grammarBand: number;
  };
  ieltsSpeaking?: string;

  fillInputContent?: string;
  fillInputBlanks?: fillInputBlanksI[];

  dragToFillContent?: string;
  dragToFillBlanks?: dragToFillBlanksI[];

  boxTickingRows?: boxTickingRowsI[];
}

export interface fillInputBlanksI {
  id: string;
  participantAnswer: string;
  correctAnswers: string[];
  caseSensitive: boolean;
  points: number;
}
export interface dragToFillBlanksI {
  id: string;
  participantAnswer: string;
  correctAnswers: string[];
  caseSensitive: boolean;
  points: number;
}
export interface boxTickingOptionsI {
  id: string;
  value: string;
  correctAnswer: boolean;
  points: number;
}
export interface boxTickingRowsI {
  question: string;
  originalAnswer: string;
  participantAnswer: string | null;
  points: number;
}

export interface ChoiceItem {
  id: string;
  text: string;
}

export interface DragDropItemI {
  id: string;
  value: string;
  itemNumber: string;
}
