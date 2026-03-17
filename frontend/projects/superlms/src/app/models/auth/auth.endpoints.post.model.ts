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

//===================================================================
//================== Define endpoints and methods ===================
//===================================================================

const apiUrl = environment.apiUrl + "/courses";

export const authEndpointPostURLsC = {};

//===================================================================
//============ Endpoint payload and response interfaces =============
//===================================================================
