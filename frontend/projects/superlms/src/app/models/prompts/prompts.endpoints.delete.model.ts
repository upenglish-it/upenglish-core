/**
 * Prompts endpoints - DELETE
 *
 * @file          prompts.endpoints.delete.model
 * @description   Defines all DELETE endpoints associated with /api/prompts/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { ApiService } from "@superlms/shared/services/api/api.service";
import { environment } from "@superlms-environment/environment";
//--- Interfaces
import { PromptI } from "./prompts.endpoints.datatypes";
//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/prompts";

export const promptsEndpointDeleteURLsC = {
  deleteById: async (apiService: ApiService, promptId: string) => await apiService.apiDelete<PromptI>(`${apiUrl}/${promptId}`),
};
