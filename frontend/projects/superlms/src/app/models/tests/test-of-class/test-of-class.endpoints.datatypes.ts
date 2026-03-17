/**
 * Tasks Data Types
 *
 * @file          tasks.endpoints.datatypes
 * @description   Defines all endpoint data types associated with /api/tasks/*
 * @author        John Mark Alicante
 * @since         2025 - 06 - 01
 */

import { TestI } from "../../../pages/task/pages/builder/form-group/test.form-group";
import { IClass, ICourse } from "@isms-core/interfaces";

// /***********************************************
//  * @interface     ItemsStatusT
//  * @description   Item status
//  */
// const ItemsStatusC = ["published", "draft", "closed"] as const;
// export type ItemsStatusT = (typeof ItemsStatusC)[number];

// /***********************************************
//  * @interface     ItemsTypeT
//  * @description   Item type
//  */
// const ItemsTypeC = ["product", "service"] as const;
// export type ItemsTypeT = (typeof ItemsTypeC)[number];

/***********************************************
 * @interface     TestOfClass
 * @description   Test of class interface
 */
export interface TestOfClass {
  _id: string;
  description: string;
  status: "draft" | "published";
  // class: IClass;
  periods: PeriodI[];
}

export interface PeriodI {
  _id: string;
  name: string;
  createdBy: string;
  sections: SectionI[];
  totalReviewedSections: number
}

export interface SectionI {
  _id: string;
  name: string;
  type: "assignment" | "mini-test";
  createdBy: string;
  tests: SectionTestI[];
}

export interface SectionTestI {
  _id: string;
  createdBy: string;
  test: TestI;
}
