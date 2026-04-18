import { api } from "../httpClient";

const BASE = "/red-flags";

export const redFlagsService = {
  findAll: (query) =>
    api.get(`${BASE}`, query),

  findOne: (id) =>
    api.get(`${BASE}/${id}`),

  create: (body) =>
    api.post(`${BASE}`, body),

  update: (id, body) =>
    api.patch(`${BASE}/${id}`, body),

  remove: (id) =>
    api.delete(`${BASE}/${id}`),
};
