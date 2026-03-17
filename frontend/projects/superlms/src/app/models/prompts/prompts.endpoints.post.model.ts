/**
 * Prompts endpoints - POST
 *
 * @file          prompts.endpoints.post.model
 * @description   Defines all POST endpoints associated with /api/prompts/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { ApiService } from "@superlms/shared/services/api/api.service";
import { environment } from "@superlms-environment/environment";
//--- Interfaces
import type { PromptI } from "./prompts.endpoints.datatypes";
//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/prompts";

export const promptsEndpointPostURLsC = {
  create: async (
    apiService: ApiService,
    body: {
      name: string;
      provider: string;
      model: string;
      apiKey: string;
      message: string;
    }
  ) => await apiService.apiPost<PromptI>(apiUrl, body),
};
