/**
 * Tasks Data Types
 *
 * @file          tasks.endpoints.datatypes
 * @description   Defines all endpoint data types associated with /api/tasks/*
 * @author        John Mark Alicante
 * @since         2025 - 06 - 01
 */

import { TestsOfClassPeriodsSectionsI } from "@superlms/interfaces/index";
import { VariationFormGroupI } from "../../pages/task/pages/builder/form-group/test-variation.form-group";
import { TestI } from "../../pages/task/pages/builder/form-group/test.form-group";
import { CourseI } from "../courses/courses.endpoints.datatypes";

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

/**
 * @interface     TaskTimelineI
 * @description   Task timeline interface
 */
export interface TaskTimelineI {
  _id: string;
  type: "notes" | "task";
  class: string;
  notes: string | null;
  periodsSection: TestsOfClassPeriodsSectionsI;
  tests: TestI[];
  createdAt: string;
  updatedAt: string;
}
