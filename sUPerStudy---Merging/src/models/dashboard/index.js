import { api } from '../httpClient';

export const dashboardService = {
    getStats: async () => {
        const response = await api.get('/dashboard/stats');
        // The API returns the data object directly, not wrapped in a generic response object
        return response.data || response;
    }
};
