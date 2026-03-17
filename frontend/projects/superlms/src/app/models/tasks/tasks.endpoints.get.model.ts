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
//--- Interfaces
import { TestI } from "../../pages/task/pages/builder/form-group/test.form-group";
import { TaskTimelineI } from "./tasks.endpoints.datatypes";
import { WithPaginationI } from "@superlms/shared/common/src/pagination-type";
// import { TaskI } from "./tasks.endpoints.datatypes";

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/tasks";

export const tasksEndpointGetURLsC = {
  getAll: async (apiService: ApiService, params?: { page?: number; limit?: number }) => await apiService.apiGet<WithPaginationI<TestI[]>>(apiUrl, { queryParams: params }),

  getById: async (
    apiService: ApiService,
    taskId: string,
    query: {
      action: "teacher-reviewing" | "student-answering" | "builder-editing" | "student-viewing-results";
      mode: "viewing" | "editing";
      type: string;
    }
  ) => await apiService.apiGet<TestI>(`${apiUrl}/${taskId}`, { queryParams: query }),

  getTimelineByClass: async (apiService: ApiService, classId: string, params?: { page?: number; limit?: number }) =>
    await apiService.apiGet<WithPaginationI<TaskTimelineI[]>>(`${apiUrl}/timeline/${classId}`, { queryParams: params }),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
