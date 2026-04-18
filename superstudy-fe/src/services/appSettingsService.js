import { api } from '../models/httpClient';

const DEFAULT_APP_SETTINGS = {
    devBypassEnabled: false,
    allowRetryAiGrading: false,
};

function normalizeAppSettings(data = {}) {
    return {
        ...DEFAULT_APP_SETTINGS,
        ...(data || {}),
    };
}

async function readSettingsDoc() {
    const result = await api.get('/settings');
    const docs = Array.isArray(result) ? result : (result?.data || []);
    return docs[0] || null;
}

export async function getAppSettings() {
    try {
        const doc = await readSettingsDoc();
        return normalizeAppSettings(doc);
    } catch (error) {
        console.error('Failed to load app settings', error);
        return { ...DEFAULT_APP_SETTINGS };
    }
}

export async function updateAppSettings(newSettings) {
    const existing = await readSettingsDoc();
    const payload = normalizeAppSettings({
        ...(existing || {}),
        ...(newSettings || {}),
    });

    const result = existing?.id
        ? await api.patch(`/settings/${existing.id}`, payload)
        : await api.post('/settings', payload);

    return normalizeAppSettings(result?.data || result);
}

export function subscribeToAppSettings(callback) {
    let active = true;

    const load = async () => {
        try {
            const data = await getAppSettings();
            if (active) callback(data);
        } catch (error) {
            console.error('Failed to subscribe to app settings', error);
        }
    };

    load();
    const intervalId = window.setInterval(load, 30000);

    return () => {
        active = false;
        window.clearInterval(intervalId);
    };
}
