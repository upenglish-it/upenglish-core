import { FormArray, FormControl, FormGroup } from "@angular/forms";
import { PromptI } from "@superlms/models/prompts/prompts.endpoints.datatypes";
import { ulid } from "ulidx";

//--- 1 -> 1 -> 1
export const ItemFormGroup = () => {
  return new FormGroup({
    id: new FormControl<string>(ulid()),
    title: new FormControl<string>(""),
    description: new FormControl<string>(""),
    points: new FormControl<number>(1),
    score: new FormControl<number>(0),
    reviewed: new FormControl<boolean>(false),
    submittedDate: new FormControl<string | null>(null),
    type: new FormControl<ItemType>("choice"),
    itemNumber: new FormControl<string>(""),
    wordCount: new FormControl<number>(500),

    participantAnswer: new FormControl<any>(null), // Answer of the participant or student
    reviewerAnswer: new FormControl<any>(null), // Answer of the reviewer or AI
    originalAnswer: new FormControl<any>(null), // Answer of the test creator

    choices: new FormArray([]),
    dragDrop: new FormArray<any>([]),
    fillIn: new FormControl<string>(""),
    boxTickingRows: new FormArray([]),

    // boxTicking: new FormControl<string>(""),

    speaking: new FormControl<string>(""),
    ieltsWriting: new FormControl<string>(""),
    ieltsWritingResult: new FormControl<{
      taskResponseBand: number;
      coherenceCohesionBand: number;
      lexicalResourceBand: number;
      grammarBand: number;
    } | null>(null),
    ieltsSpeaking: new FormControl<string>(""),

    // Fill-in (Input) specific
    fillInputCaseSensitive: new FormControl<boolean>(false),
    /** fill-in-input: one entry per blank, keyed by span data-blank-id */
    fillInputBlanks: new FormControl<FillInputBlankI[]>([]),

    /** Drag-to-fill: passage HTML (counterpart to fillInputContent / fillIn) */
    dragToFillContent: new FormControl<string>(""),
    /** Drag-to-fill: one entry per blank, keyed by span data-blank-id (same shape as fillInputBlanks) */
    dragToFillBlanks: new FormControl<DragToFillBlankI[]>([]),

    aiPrompt: new FormControl<PromptI | null>(null), // id of the ai prompt
  });
};

/**
 * @interface     ItemType
 * @description   Item type
 */
const ItemsStatusC = ["instruction", "choice", "fill-in", "drag-drop", "fill-in-radio", "fill-in-input", "drag-to-fill", "box-ticking", "speaking", "ielts-writing", "ielts-speaking"] as const;
export type ItemType = (typeof ItemsStatusC)[number];

export interface ItemFormGroupI {
  id: string;
  title: string;
  description: string;
  points: number;
  score: number;
  reviewed: boolean;
  type: ItemType;
  wordCount: number;
  itemNumber: string;

  participantAnswer?: any;
  reviewerAnswer?: any;
  originalAnswer?: any;

  choices?: ChoiceItem[];
  fillIn?: string;
  dragDrop?: DragDropItem[];
  boxTickingRows?: BoxTickingRowI[];
  boxTickingQuestion?: string;
  boxTickingOptions?: BoxTickingOptionI[];
  boxTickingAnswers?: string[];
  boxTickingMaxSelection?: number;
  // boxTicking?: string;
  // boxTickingRadio?: string;
  // boxTickingInput?: string;
  speaking?: string;
  ieltsWriting?: string;
  ieltsWritingResult?: {
    taskResponseBand: number;
    coherenceCohesionBand: number;
    lexicalResourceBand: number;
    grammarBand: number;
  };
  ieltsSpeaking?: string;

  // Fill-in (Input) specific
  fillInputCaseSensitive?: boolean;
  fillInputBlanks?: FillInputBlankI[];

  /** Drag-to-fill: passage HTML (payload field dragToFillContent) */
  dragToFillContent?: string;
  /** Drag-to-fill: per-blank config (payload field dragToFillBlanks) */
  dragToFillBlanks?: DragToFillBlankI[];

  aiPrompt: PromptI | null; // id of the ai prompt
}

export interface FillInputBlankI {
  id: string;
  participantAnswer: string;
  correctAnswers: string[];
  caseSensitive: boolean;
  points: number;
}

/** Drag-to-fill: same structure as FillInputBlankI for per-blank config in payload (dragToFillBlanks). */
export interface DragToFillBlankI {
  id: string;
  participantAnswer: string;
  correctAnswers: string[];
  caseSensitive: boolean;
  points: number;
}

export interface ChoiceItem {
  id: string;
  text: string;
}

export interface DragDropItem {
  id: string;
  value: string;
  itemNumber: string;

  //--- For storing answers and scoring
  participantAnswer: string;
  reviewerAnswer: string;
  points: number;
  score: number;
}

export interface BoxTickingRowI {
  question: string;
  originalAnswer: string | null;
  participantAnswer: string | null;
}

/** Backend-aligned shape for box-ticking (do not change: must match backend ItemI) */
export interface BoxTickingOptionI {
  id: string;
  value: string;
  correctAnswer: boolean;
  points: number;
}
