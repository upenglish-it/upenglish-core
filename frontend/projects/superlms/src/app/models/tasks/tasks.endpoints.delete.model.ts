/**
 * Tasks endpoints - DELETE
 *
 * @file          tasks.endpoints.delete.model
 * @description   Defines all DELETE endpoints associated with /api/tasks/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { ApiService } from "@superlms/shared/services/api/api.service";
import { environment } from "@superlms-environment/environment";
//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/tasks";

export const tasksEndpointDeleteURLsC = {
  deleteById: async (apiService: ApiService, id: string) => await apiService.apiDelete(`${apiUrl}/${id}`),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
