/**
 * Prompts endpoints - PATCH
 *
 * @file          prompts.endpoints.patch.model
 * @description   Defines all PATCH endpoints associated with /api/prompts/*
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

export const promptsEndpointPatchURLsC = {
  updateById: async (
    apiService: ApiService,
    promptId: string,
    body: {
      name: string;
      provider: string;
      model: string;
      apiKey: string;
      message: string;
    }
  ) => await apiService.apiPatch<PromptI>(`${apiUrl}/${promptId}`, body),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
