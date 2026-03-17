/**
 * Account endpoints - POST
 *
 * @file          account.endpoints.post.model
 * @description   Defines all POST endpoints associated with /api/account/*
 * @author        John Mark Alicante
 * @since         2024 - 08 - 20
 */

import { environment } from "@superlms-environment/environment";
//--- Interfaces
import { FileManagerI } from "../../interfaces";
//--- Services
import { ApiService } from "@superlms/shared/services/api/api.service";

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const supplierApiUrl = environment.apiUrl + "/file-manager";

export const fileManagerEndpointPostURLsC = {
  upload: async (apiService: ApiService, body: FormData) => await apiService.apiPost<FileManagerI[]>(supplierApiUrl, body),
};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
