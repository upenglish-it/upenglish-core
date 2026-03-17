/**
 * Api Service
 *
 * @file          api.service
 * @description   Provides a single service to be used for all API calls
 * @author        John Mark Alicante
 * @since         2025 - 06 - 01
 */

import { Injectable } from "@angular/core";

//--- Services
import { ApiService as _ApiService } from "@superlms/shared/services/api/api.service";

//--- Endpoint Models
import { tasksEndpointGetURLsC } from "@superlms/models/tasks/tasks.endpoints.get.model";
import { tasksEndpointPostURLsC } from "@superlms/models/tasks/tasks.endpoints.post.model";
import { tasksEndpointPatchURLsC } from "@superlms/models/tasks/tasks.endpoints.patch.model";
import { tasksEndpointDeleteURLsC } from "@superlms/models/tasks/tasks.endpoints.delete.model";

import { coursesEndpointGetURLsC } from "@superlms/models/courses/courses.endpoints.get.model";

import { testsOfClassEndpointGetURLsC } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.get.model";
import { testsOfClassEndpointPostURLsC } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.post.model";
import { testsOfClassEndpointPatchURLsC } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.patch.model";
import { testsOfClassEndpointDeleteURLsC } from "@superlms/models/tests/test-of-class/test-of-class.endpoints.delete.model";

import { classesEndpointGetURLsC } from "@superlms/models/classes/classes.endpoints.get.model";

import { accountEndpointGetURLsC } from "@superlms/models/account/account.endpoints.get.model";

import { authEndpointGetURLsC } from "@superlms/models/auth/auth.endpoints.get.model";

import { fileManagerEndpointPostURLsC } from "@superlms/models/file-manager/file-manager.endpoints.post.model";

//--- Prompts
import { promptsEndpointGetURLsC } from "@superlms/models/prompts/prompts.endpoints.get.model";
import { promptsEndpointPostURLsC } from "@superlms/models/prompts/prompts.endpoints.post.model";
import { promptsEndpointPatchURLsC } from "@superlms/models/prompts/prompts.endpoints.patch.model";
import { promptsEndpointDeleteURLsC } from "@superlms/models/prompts/prompts.endpoints.delete.model";

@Injectable({ providedIn: "root" })
export class ApiService extends _ApiService {
  //--- Endpoints model
  public readonly endPointsC = {
    //--- /api/tasks/*
    tasks: {
      get: tasksEndpointGetURLsC,
      post: tasksEndpointPostURLsC,
      patch: tasksEndpointPatchURLsC,
      delete: tasksEndpointDeleteURLsC,
    },

    //--- /api/prompts/*
    prompts: {
      get: promptsEndpointGetURLsC,
      post: promptsEndpointPostURLsC,
      patch: promptsEndpointPatchURLsC,
      delete: promptsEndpointDeleteURLsC,
    },

    //--- /api/tests/of-class/*
    testOfClass: {
      get: testsOfClassEndpointGetURLsC,
      post: testsOfClassEndpointPostURLsC,
      patch: testsOfClassEndpointPatchURLsC,
      delete: testsOfClassEndpointDeleteURLsC,
    },
    //--- /api/courses/*
    courses: {
      get: coursesEndpointGetURLsC,
    },
    //--- /api/classes/*
    classes: {
      get: classesEndpointGetURLsC,
    },
    //--- /api/account/*
    account: {
      get: accountEndpointGetURLsC,
    },
    //--- /api/auth/*
    auth: {
      get: authEndpointGetURLsC,
    },
    //--- /api/file-manager/*
    fileManager: {
      post: fileManagerEndpointPostURLsC,
    },
  };
}
