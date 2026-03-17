/**
 * Tests Of Class Periods Sections Data Types
 *
 * @file          tests-of-class-periods-sections.interface
 * @description   Period sections detail interface
 * @author        John Mark Alicante
 * @since         2025 - 11 - 26
 */

/**
 * @interface     TestsOfClassPeriodsSectionsI
 * @description   Period sections detail interface
 */
export interface TestsOfClassPeriodsSectionsI {
  _id: string;
  name: string;
  class: string;
  completed: boolean;
  testsOfClassPeriodId: string;
  testsOfClassId: string;
  createdBy: string;
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
}
