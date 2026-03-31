import { createContext, useContext, useState, useEffect } from 'react';
import { getAppSettings, subscribeToAppSettings } from '../services/appSettingsService';

const AppSettingsContext = createContext();

export function useAppSettings() {
    return useContext(AppSettingsContext);
}

export function AppSettingsProvider({ children }) {
    const [settings, setSettings] = useState({ devBypassEnabled: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribe;

        // Load initial
        getAppSettings().then(data => {
            setSettings(data);
            setLoading(false);
        }).catch(err => {
            console.error("Failed to load app settings", err);
            setLoading(false);
        });

        // Subscribe to changes
        try {
            unsubscribe = subscribeToAppSettings((data) => {
                setSettings(data);
            });
        } catch (err) {
            console.error("Failed to subscribe to app settings", err);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const value = {
        settings,
        loading
    };

    return (
        <AppSettingsContext.Provider value={value}>
            {children}
        </AppSettingsContext.Provider>
    );
}
