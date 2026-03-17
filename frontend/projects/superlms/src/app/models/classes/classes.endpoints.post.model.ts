/**
 * Tasks endpoints - POST
 *
 * @file          tasks.endpoints.post.model
 * @description   Defines all POST endpoints associated with /api/tasks/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { ApiService } from "@superlms/shared/services/api/api.service";
import { environment } from "@superlms-environment/environment";
import { CourseI } from "./classes.endpoints.datatypes";

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/courses";

export const coursesEndpointPostURLsC = {
  create: async (apiService: ApiService, payload: CourseI) => await apiService.apiPost<CourseI>(apiUrl, payload),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
