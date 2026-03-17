/**
 * Prompts endpoints - GET
 *
 * @file          prompts.endpoints.get.model
 * @description   Defines all GET endpoints associated with /api/prompts/*
 * @author        John Mark Alicante
 * @since         2026 - 01 - 14
 */

import { environment } from "@superlms-environment/environment";
//--- Services
import type { ApiService } from "@superlms/shared/services/api/api.service";
//--- Interfaces
import { PromptI } from "./prompts.endpoints.datatypes";

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/prompts";

export const promptsEndpointGetURLsC = {
  list: async (apiService: ApiService) => await apiService.apiGet<PromptI[]>(apiUrl),

  getById: async (apiService: ApiService, promptId: string) => await apiService.apiGet<PromptI>(`${apiUrl}/${promptId}`),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
