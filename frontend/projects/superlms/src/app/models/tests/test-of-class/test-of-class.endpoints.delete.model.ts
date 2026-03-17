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

export const testsOfClassEndpointDeleteURLsC = {
  deletePeriodById: async (apiService: ApiService, periodId: string) => await apiService.apiDelete<TestI>(`${apiUrl}/periods/${periodId}`),

  deleteSectionById: async (apiService: ApiService, payload: { periodId: string; sectionId: string }) =>
    await apiService.apiDelete<TestI>(`${apiUrl}/periods/${payload.periodId}/sections/${payload.sectionId}`),

  deleteTestById: async (apiService: ApiService, payload: { periodId: string; sectionId: string; testId: string }) =>
    await apiService.apiDelete<TestI>(`${apiUrl}/periods/${payload.periodId}/sections/${payload.sectionId}/tests/${payload.testId}`),

  deleteAnnouncementById: async (apiService: ApiService, announcementId: string) => await apiService.apiDelete<TestI>(`${apiUrl}/announcement/${announcementId}`),
};
