import { api } from "../httpClient";

export const contentProposalsService = {
  findAll: async (params) => {
    const res = await api.get('/content-proposals', { params });
    return res.data || res;
  },
  findOne: async (id) => {
    const res = await api.get(`/content-proposals/${id}`);
    return res.data || res;
  },
  create: async (data) => {
    const res = await api.post('/content-proposals', data);
    return res.data || res;
  },
  update: async (id, data) => {
    const res = await api.patch(`/content-proposals/${id}`, data);
    return res.data || res;
  },
  remove: async (id) => {
    const res = await api.delete(`/content-proposals/${id}`);
    return res.data || res;
  }
};
