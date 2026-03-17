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
import { TestI } from "../../../pages/task/pages/builder/form-group/test.form-group";
//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/tests-of-class";

export const testsOfClassEndpointPatchURLsC = {
  updateDescription: async (apiService: ApiService, payload: { classId: string; description: string }) => await apiService.apiPatch<[]>(`${apiUrl}/description`, payload),
  updateStatus: async (apiService: ApiService, payload: { classId: string; status: string }) => await apiService.apiPatch<[]>(`${apiUrl}/status`, payload),
  updatePeriodName: async (apiService: ApiService, periodId: string, newName: string) => await apiService.apiPatch<TestI>(`${apiUrl}/periods/${periodId}`, { name: newName }),
  updateSectionName: async (apiService: ApiService, sectionId: string, newName: string) => await apiService.apiPatch<TestI>(`${apiUrl}/sections/${sectionId}`, { name: newName }),

  resetTest: async (apiService: ApiService, payload: { studentId: string; periodId: string; sectionId: string }) =>
    await apiService.apiPatch<TestI>(`${apiUrl}/periods/${payload.periodId}/sections/${payload.sectionId}/reset`),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
