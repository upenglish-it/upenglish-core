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
//--- Interfaces
import { TestI } from "../../pages/task/pages/builder/form-group/test.form-group";
//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/tasks";

export const tasksEndpointPatchURLsC = {
  updateById: async (
    apiService: ApiService,
    taskId: string,
    payload: Partial<TestI>,
    query: {
      action: "teacher-reviewing" | "student-answering" | "builder-editing" | "student-viewing-results";
      mode: "viewing" | "editing";
      type: string;
    }
  ) => await apiService.apiPatch<TestI>(`${apiUrl}/${taskId}`, payload, { params: query }),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
