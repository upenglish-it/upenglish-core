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

export const tasksEndpointPostURLsC = {
  create: async (apiService: ApiService, payload: { name: string; type: string }) => await apiService.apiPost<TestI>(apiUrl, payload),
  studentSubmitTask: async (apiService: ApiService, payload: { taskId: string }) => await apiService.apiPost<TestI>(`${apiUrl}/student/submit-task`, payload),
  teacherMarkTaskAsReviewed: async (apiService: ApiService, payload: { taskId: string }) => await apiService.apiPost<TestI>(`${apiUrl}/teacher/mark-task-as-reviewed`, payload),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
