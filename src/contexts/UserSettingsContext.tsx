import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';

// Determine the base API URL based on the environment
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api';
  } else {
    return 'http://localhost:5001/api';
  }
};
const BACKEND_API_BASE_URL = getApiBaseUrl();

type UserSettings = {
  notificationSettings: {
    telegramChatId: string | null;
    discordWebhookUrl: string | null;
    deliveryPreference: string;
  };
  alertPreferences: {
    thresholdViews: number;
    thresholdLikes: number;
    thresholdComments: number;
    thresholdVelocity: number;
    filterChannels: string;
    filterNiches: string;
    filterHashtags: string;
  };
  alertTemplates: {
    templateTelegram: string;
    templateDiscord: string;
    templateEmailSubject: string;
    templateEmailPreview: string;
  };
};

type UserSettingsContextType = {
  settings: UserSettings | null;
  isLoading: boolean;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
};

const defaultSettings: UserSettings = {
  notificationSettings: {
    telegramChatId: null,
    discordWebhookUrl: null,
    deliveryPreference: 'Instantly',
  },
  alertPreferences: {
    thresholdViews: 10000,
    thresholdLikes: 1000,
    thresholdComments: 100,
    thresholdVelocity: 500,
    filterChannels: '',
    filterNiches: '',
    filterHashtags: '',
  },
  alertTemplates: {
    templateTelegram: '',
    templateDiscord: '',
    templateEmailSubject: '',
    templateEmailPreview: '',
  },
};

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: null,
  isLoading: true,
  updateSettings: async () => {},
  refreshSettings: async () => {},
});

export const useUserSettings = () => useContext(UserSettingsContext);

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const [notifications, preferences, templates] = await Promise.all([
        axios.get(`${BACKEND_API_BASE_URL}/users/notifications`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_API_BASE_URL}/users/alert-preferences`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${BACKEND_API_BASE_URL}/users/alert-templates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
      ]);

      setSettings({
        notificationSettings: {
          telegramChatId: notifications.data.telegram_chat_id || null,
          discordWebhookUrl: notifications.data.discord_webhook_url || null,
          deliveryPreference: notifications.data.delivery_preference || 'Instantly',
        },
        alertPreferences: {
          thresholdViews: preferences.data.threshold_views || 10000,
          thresholdLikes: preferences.data.threshold_likes || 1000,
          thresholdComments: preferences.data.threshold_comments || 100,
          thresholdVelocity: preferences.data.threshold_velocity || 500,
          filterChannels: preferences.data.filter_channels || '',
          filterNiches: preferences.data.filter_niches || '',
          filterHashtags: preferences.data.filter_hashtags || '',
        },
        alertTemplates: {
          templateTelegram: templates.data.template_telegram || '',
          templateDiscord: templates.data.template_discord || '',
          templateEmailSubject: templates.data.template_email_subject || '',
          templateEmailPreview: templates.data.template_email_preview || '',
        },
      });
    } catch (error) {
      console.error('Failed to fetch user settings:', error);
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!token) return;
    setIsLoading(true);
    try {
      // Update each section separately
      if (newSettings.notificationSettings) {
        await axios.put(
          `${BACKEND_API_BASE_URL}/users/notifications`,
          newSettings.notificationSettings,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      if (newSettings.alertPreferences) {
        await axios.put(
          `${BACKEND_API_BASE_URL}/users/alert-preferences`,
          newSettings.alertPreferences,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      if (newSettings.alertTemplates) {
        await axios.put(
          `${BACKEND_API_BASE_URL}/users/alert-templates`,
          newSettings.alertTemplates,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
      }
      await fetchSettings(); // Refresh all settings after update
    } catch (error) {
      console.error('Failed to update user settings:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSettings();
    }
  }, [token, fetchSettings]);

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}; 