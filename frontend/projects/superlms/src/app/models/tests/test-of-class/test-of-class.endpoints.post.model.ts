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
import { AnnouncementI } from "./test-of-class.endpoints.get.model";
//--- Interfaces
//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/tests-of-class";

export const testsOfClassEndpointPostURLsC = {
  addPeriod: async (apiService: ApiService, payload: { name: string; classId: string }) => await apiService.apiPost<[]>(`${apiUrl}/periods`, payload),
  addSection: async (apiService: ApiService, payload: { name: string; testOfClassId: string; classId: string; periodId: string; type: "assignment" | "mini-test" }) =>
    await apiService.apiPost<[]>(`${apiUrl}/periods/${payload.periodId}/sections`, payload),
  addTest: async (apiService: ApiService, payload: { testOfClassId: string; classId: string; periodId: string; sectionId: string; testId: string }) =>
    await apiService.apiPost<[]>(`${apiUrl}/periods/${payload.periodId}/sections/${payload.sectionId}/tests`, payload),

  addRedFlag: async (apiService: ApiService, payload: { classId: string; studentId: string; message: string }) => await apiService.apiPost<[]>(`${apiUrl}/red-flags`, payload),

  updateAnnouncement: async (apiService: ApiService, payload: { classId: string; studentId: string; testOfClassId: string; title: string; message: string }) =>
    await apiService.apiPost<AnnouncementI>(`${apiUrl}/announcement`, payload),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
