import { api } from "../httpClient";

// ── Sharing Service ─────────────────────────────────────────────────────────
const BASE = "/sharing";

export const sharingService = {
  // ─── User lookup ──────────────────────────────────────────────────────
  /** Find an SST user by email (for sharing UI autocomplete) */
  findUser: (email, role) =>
    api.get(`${BASE}/find-user`, { email, role }),

  // ─── Public / Teacher-visible toggles ─────────────────────────────────
  /** Toggle isPublic on a resource */
  togglePublic: (body) =>
    api.patch(`${BASE}/public`, body),

  /** Toggle teacherVisible on an admin resource */
  toggleTeacherVisible: (body) =>
    api.patch(`${BASE}/teacher-visible`, body),

  // ─── Group access ─────────────────────────────────────────────────────
  /** Add a resource to a group's access array */
  addGroupAccess: (body) =>
    api.post(`${BASE}/group-access/add`, body),

  /** Remove a resource from a group's access array */
  removeGroupAccess: (body) =>
    api.delete(`${BASE}/group-access/remove`, { data: body }),

  /** Sync all group access arrays for a resource */
  syncGroupAccess: (body) =>
    api.patch(`${BASE}/group-access/sync`, body),

  // ─── Individual user access ───────────────────────────────────────────
  /** Add a resource to an individual user's access */
  addUserAccess: (body) =>
    api.post(`${BASE}/user-access/add`, body),

  /** Remove a resource from an individual user's access */
  removeUserAccess: (body) =>
    api.delete(`${BASE}/user-access/remove`, { data: body }),

  /** Get all SST access arrays for a user */
  getUserAccess: (userId) =>
    api.get(`${BASE}/user-access`, { userId }),

  /** Get all users and groups that have access to a specific resource */
  getResourceAccess: (resourceType, resourceId) =>
    api.get(`${BASE}/resource-access`, { resourceType, resourceId }),

  // ─── Collaborators ────────────────────────────────────────────────────
  /** Add a collaborator to a teacher resource */
  addCollaborator: (body) =>
    api.post(`${BASE}/collaborators/add`, body),

  /** Remove a collaborator from a teacher resource */
  removeCollaborator: (body) =>
    api.delete(`${BASE}/collaborators/remove`, { data: body }),

  /** Update a collaborator's role (viewer / editor) */
  updateCollaboratorRole: (body) =>
    api.patch(`${BASE}/collaborators/role`, body),

  /** Transfer ownership of a teacher resource to another teacher */
  transferOwnership: (body) =>
    api.patch(`${BASE}/collaborators/transfer-ownership`, body),

  /** Get all resources where a teacher is a collaborator */
  getCollaboratedResources: (resourceType, teacherId) =>
    api.get(`${BASE}/collaborators/my-resources`, { resourceType, teacherId }),

  // ─── Admin → per-teacher sharing ──────────────────────────────────────
  /** Share an admin resource with a specific teacher */
  addTeacherShare: (body) =>
    api.post(`${BASE}/teacher-share/add`, body),

  /** Remove a specific teacher from an admin resource's shared list */
  removeTeacherShare: (body) =>
    api.delete(`${BASE}/teacher-share/remove`, { data: body }),

  /** Get teachers explicitly shared on an admin resource */
  getTeacherShares: (resourceType, resourceId) =>
    api.get(`${BASE}/teacher-share`, { resourceType, resourceId }),
};
