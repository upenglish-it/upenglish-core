/**
 * Courses endpoints - GET
 *
 * @file          courses.endpoints.get.model
 * @description   Defines all GET endpoints associated with /api/courses/*
 * @author        John Mark Alicante
 * @since         2025 - 01 - 01
 */

import { IAccount } from "@isms-core/interfaces";
import { IProperties } from "@isms-core/interfaces/src/properties/properties.interface";
import { environment } from "@superlms-environment/environment";
//--- Services
import type { ApiService } from "@superlms/shared/services/api/api.service";
//--- Interfaces

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const ismsApiUrl = environment.ismsApiUrl + "/accounts";

export const accountEndpointGetURLsC = {
  account: async (apiService: ApiService) => await apiService.apiGet<{ account: IAccount; properties: IProperties[]; selectedBranch: string }>(ismsApiUrl),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
