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
import { CourseI } from "./courses.endpoints.datatypes";

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const ismsApiUrl = environment.ismsApiUrl + "/courses";

export const coursesEndpointGetURLsC = {
  getAll: async (apiService: ApiService, query: { limit: number }) => await apiService.apiGet<CourseI[]>(ismsApiUrl, { queryParams: query }),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
