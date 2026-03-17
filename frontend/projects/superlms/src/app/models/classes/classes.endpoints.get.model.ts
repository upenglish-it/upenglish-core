/**
 * Courses endpoints - GET
 *
 * @file          courses.endpoints.get.model
 * @description   Defines all GET endpoints associated with /api/courses/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { environment } from "@superlms-environment/environment";
//--- Services
import type { ApiService } from "@superlms/shared/services/api/api.service";
//--- Interfaces
import { ClassForCoursesI } from "./classes.endpoints.datatypes";

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/tests-of-class";

export const classesEndpointGetURLsC = {
  teacherAssignedClassForMyCourses: async (apiService: ApiService) => await apiService.apiGet<ClassForCoursesI[]>(`${apiUrl}/teacher/assigned-class-for-my-courses`),

  adminClassForCourses: async (apiService: ApiService) => await apiService.apiGet<ClassForCoursesI[]>(`${apiUrl}/admin/classes`),

  adminCourses: async (apiService: ApiService) => await apiService.apiGet<ClassForCoursesI[]>(`${apiUrl}/admin/courses`),

  adminClasses: async (apiService: ApiService) => await apiService.apiGet<ClassForCoursesI[]>(`${apiUrl}/admin/classes`),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
