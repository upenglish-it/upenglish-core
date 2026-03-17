/**
 * Courses Data Types
 *
 * @file          courses.endpoints.datatypes
 * @description   Defines all endpoint data types associated with /api/courses/*
 * @author        John Mark Alicante
 * @since         2025 - 06 - 01
 */

//--- Interfaces
import { IClass, ICourse } from "@isms-core/interfaces";
import { TestI } from "../../pages/task/pages/builder/form-group/test.form-group";

export interface ClassForCoursesI extends IClass {
  course: ICourse;
  ieltsTestsOfCourse: TestI;
  typeOfRate?: string;
}
