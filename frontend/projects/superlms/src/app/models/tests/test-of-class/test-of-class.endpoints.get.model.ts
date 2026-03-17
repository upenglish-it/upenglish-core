/**
 * Tasks endpoints - GET
 *
 * @file          tasks.endpoints.get.model
 * @description   Defines all GET endpoints associated with /api/tasks/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { environment } from "@superlms-environment/environment";
//--- Services
import type { ApiService } from "@superlms/shared/services/api/api.service";
import { TestOfClass } from "./test-of-class.endpoints.datatypes";
import { ClassForCoursesI } from "@superlms/models/classes/classes.endpoints.datatypes";
import { IAccount, IClass, ICourse, ISchedule } from "@isms-core/interfaces";
//--- Interfaces
// import { TaskI } from "./tasks.endpoints.datatypes";

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/tests-of-class";

export const testsOfClassEndpointGetURLsC = {
  //--- When admin/teacher/student wants to view his/her test details
  getStudentTestDetails: async (apiService: ApiService, query: { classId: string; studentId: string, date?: string }) =>
    await apiService.apiGet<GetStudentTestDetailsResponseI>(`${apiUrl}/student-test-details`, { queryParams: query }),

  //--- When admin/teacher wants to view the test of a class
  getTestOfClass: async (apiService: ApiService, query: { classId: string }) => await apiService.apiGet<GetTestOfClassResponseI>(`${apiUrl}/test-of-class`, { queryParams: query }),

  // assignedCoursesInTeacher: async (apiService: ApiService) => await apiService.apiGet<CourseI[]>(`${apiUrl}/teacher/courses`),
  // assignedClassesInTeacher: async (apiService: ApiService) => await apiService.apiGet<CourseI[]>(`${apiUrl}/teacher/classes`),
  assignedClassesInStudent: async (apiService: ApiService) => await apiService.apiGet<ClassForCoursesI[]>(`${apiUrl}/student/classes`),

  //--- When admin/teacher wants to view the test of a class
  redFlags: async (apiService: ApiService, query: { classId: string; studentId: string }) => await apiService.apiGet<GetRedFlagsI[]>(`${apiUrl}/red-flags`, { queryParams: query }),

  announcements: async (apiService: ApiService) => await apiService.apiGet<AnnouncementI[]>(`${apiUrl}/announcements`),

  announcementById: async (apiService: ApiService, query: { testOfClassId: string }) =>
    await apiService.apiGet<AnnouncementI[]>(`${apiUrl}/announcement/by-id`, { queryParams: query }),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
export interface GetStudentTestDetailsResponseI {
  student: IAccount;
  test: TestOfClass;
  class: IClass;
  course: ICourse;
}

export interface GetTestOfClassResponseI {
  students: {
    account: IAccount;
    _id: string;
  }[];
  scheduleAndStaff: {
    careTaker: IAccount;
    homeworkChecker: IAccount;
    teachers: IAccount[];
    time: { from: string; to: string };
    schedule: ISchedule;
    startDate: string;
    room: string;
  };
  test: TestOfClass;
  class: IClass;
  course: ICourse;
}

export interface GetRedFlagsI {
  _id: string;
  message: string;
  class: string;
  student: string;
  createdBy: string;
  properties: string;
  propertiesBranches: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementI {
  _id: string;
  title: string;
  message: string;
  class: string;
  student: string;
  createdBy: Pick<IAccount, "_id" | "firstName" | "lastName" | "profilePhoto">;
  createdAt: string;
  updatedAt: string;
}
