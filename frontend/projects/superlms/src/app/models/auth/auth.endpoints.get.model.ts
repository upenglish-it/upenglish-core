/**
 * Courses endpoints - GET
 *
 * @file          courses.endpoints.get.model
 * @description   Defines all GET endpoints associated with /api/courses/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { IAccount } from "@isms-core/interfaces";
import { environment } from "@superlms-environment/environment";
//--- Services
import type { ApiService } from "@superlms/shared/services/api/api.service";
//--- Interfaces

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const ismsApiUrl = environment.ismsApiUrl + "/auth";

export const authEndpointGetURLsC = {
  generateToken: async (apiService: ApiService, query: { emailAddress: string }) =>
    await apiService.apiGet<{ account: IAccount; properties: []; selectedBranch: string; authorizationToken: string }>(`${ismsApiUrl}/generate-token`, {
      queryParams: { emailAddress: query.emailAddress },
    }),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
