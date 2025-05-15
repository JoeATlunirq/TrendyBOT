import { create } from 'zustand';
import axios from 'axios';
import { toast } from '@/components/ui/use-toast';

// --- Constants ---
// Define Metric Keys for consistency (used in timeWindowMetrics array)
export const METRIC_KEYS = {
    VIEWS: 'views',
    LIKES: 'likes',
    COMMENTS: 'comments',
    VELOCITY: 'velocity',
} as const;

// Type for metric keys
type MetricKey = typeof METRIC_KEYS[keyof typeof METRIC_KEYS];


// Define types for state sections
type ThresholdPreferences = {
    thresholdViews: number;
    thresholdLikes: number;
    thresholdComments: number;
    thresholdVelocity: number;
    // --- Relative Performance ---
    thresholdRelativeViewPerformancePercent: number | null; // e.g., 150 (for 150%) - Nullable if optional
    thresholdRelativeViewMetric: string; // e.g., '30d_avg_views' - For future expansion
    // --- NEW Individual Time Windows ---
    thresholdViewsTimeWindowHours: number | null;
    thresholdLikesTimeWindowHours: number | null;
    thresholdCommentsTimeWindowHours: number | null;
};

type FilterPreferences = {
    filterChannels: string;
};

// Combined type for initial fetch/state
type AlertPreferencesData = ThresholdPreferences & FilterPreferences;

// Column Names (ensure match backend .env/NocoDB)
// Use import.meta.env for Vite projects
const THRESHOLD_VIEWS_COLUMN = import.meta.env.VITE_THRESHOLD_VIEWS_COLUMN || 'threshold_views';
const THRESHOLD_LIKES_COLUMN = import.meta.env.VITE_THRESHOLD_LIKES_COLUMN || 'threshold_likes';
const THRESHOLD_COMMENTS_COLUMN = import.meta.env.VITE_THRESHOLD_COMMENTS_COLUMN || 'threshold_comments';
const THRESHOLD_VELOCITY_COLUMN = import.meta.env.VITE_THRESHOLD_VELOCITY_COLUMN || 'threshold_velocity';
// --- Relative Performance Column Names ---
const THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT_COLUMN = import.meta.env.VITE_THRESHOLD_RELATIVE_VIEW_PERFORMANCE_PERCENT_COLUMN || 'threshold_relative_view_performance_percent';
const THRESHOLD_RELATIVE_VIEW_METRIC_COLUMN = import.meta.env.VITE_THRESHOLD_RELATIVE_VIEW_METRIC_COLUMN || 'threshold_relative_view_metric';
// --- NEW Individual Time Window Column Names ---
const THRESHOLD_VIEWS_TIME_WINDOW_HOURS_COLUMN = import.meta.env.VITE_THRESHOLD_VIEWS_TIME_WINDOW_HOURS_COLUMN || 'threshold_views_time_window_hours';
const THRESHOLD_LIKES_TIME_WINDOW_HOURS_COLUMN = import.meta.env.VITE_THRESHOLD_LIKES_TIME_WINDOW_HOURS_COLUMN || 'threshold_likes_time_window_hours';
const THRESHOLD_COMMENTS_TIME_WINDOW_HOURS_COLUMN = import.meta.env.VITE_THRESHOLD_COMMENTS_TIME_WINDOW_HOURS_COLUMN || 'threshold_comments_time_window_hours';

const FILTER_CHANNELS_COLUMN = import.meta.env.VITE_FILTER_CHANNELS_COLUMN || 'filter_channels';

// Default values
const defaultThresholds: ThresholdPreferences = {
    thresholdViews: 3000000,
    thresholdLikes: 50000,
    thresholdComments: 450,
    thresholdVelocity: 500,
    // --- Relative Performance Defaults ---
    thresholdRelativeViewPerformancePercent: null, // Default to null/disabled
    thresholdRelativeViewMetric: '30d_avg_views', // Default comparison metric
    // --- NEW Individual Time Window Defaults ---
    thresholdViewsTimeWindowHours: null,
    thresholdLikesTimeWindowHours: null,
    thresholdCommentsTimeWindowHours: null,
};

const defaultFilters: FilterPreferences = {
    filterChannels: '{"groups":[], "selectedResearchGroupId": null}',
};

const defaultPreferences: AlertPreferencesData = { ...defaultThresholds, ...defaultFilters };

// API URL
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) return '/api';
  return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';
};
const BACKEND_API_BASE_URL = getApiBaseUrl();

// --- REMOVED Helper for parsing time window metrics ---


// Define the store's state shape
interface AlertPreferencesState {
  thresholds: ThresholdPreferences | null;
  filters: FilterPreferences | null;
  // Separate loading states
  isLoading: boolean;
  isSavingThresholds: boolean;
  isResettingThresholds: boolean;
  actions: {
    fetchPreferences: (token: string | null) => Promise<void>;
    // Updated setThresholdField to handle all threshold fields including new time windows
    setThresholdField: (field: keyof ThresholdPreferences, value: string) => void;
    // --- REMOVED Time Window Setter ---
    setFilterField: (field: keyof FilterPreferences, value: string) => void;
    saveThresholds: (token: string | null) => Promise<void>;
    resetThresholds: (token: string | null) => Promise<void>;
  };
}

// Create the Zustand store
export const useAlertPreferencesStore = create<AlertPreferencesState>((set, get) => ({
  thresholds: null,
  filters: defaultFilters,
  isLoading: true,
  isSavingThresholds: false,
  isResettingThresholds: false,

  actions: {
    // --- Fetch Preferences ---
    fetchPreferences: async (token) => {
      if (!token) {
        console.log("[AlertStore] fetchPreferences: No token, setting defaults.");
        set({ isLoading: false, thresholds: defaultThresholds, filters: defaultFilters });
        return;
      }
      set({ isLoading: true });
      console.log("[AlertStore] fetchPreferences: Fetching with token...");
      try {
        const response = await axios.get<{ [key: string]: any }>(`${BACKEND_API_BASE_URL}/users/alert-preferences`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log("[AlertStore] fetchPreferences: Raw API Response Data:", response.data);
        
        const data = response.data || {};

        // Helper to safely get number or null
        const getNumberOrNull = (key: string, defaultValue: number | null): number | null => {
            const val = data[key]; // Use data from response
             if (val === null || val === undefined) return defaultValue; 
             if (typeof val === 'number' && !isNaN(val)) return val;
             if (typeof val === 'string') {
                 const parsed = parseInt(val, 10);
                 if (!isNaN(parsed)) return parsed;
             }
             // console.warn(`[fetchPreferences] Invalid number format for ${key} in API response, using default ${defaultValue}`);
             return defaultValue; 
        };
        // Helper to safely get number or default (for non-nullable)
         const getNumberOrDefault = (key: string, defaultValue = 0) => {
             const val = getNumberOrNull(key, defaultValue); // Reuse null check
             return val === null ? defaultValue : val; // Ensure non-null return
         };

        // Construct the state objects
        const newThresholds = {
            thresholdViews: getNumberOrDefault('thresholdViews', defaultThresholds.thresholdViews),
            thresholdLikes: getNumberOrDefault('thresholdLikes', defaultThresholds.thresholdLikes),
            thresholdComments: getNumberOrDefault('thresholdComments', defaultThresholds.thresholdComments),
            thresholdVelocity: getNumberOrDefault('thresholdVelocity', defaultThresholds.thresholdVelocity),
            thresholdRelativeViewPerformancePercent: getNumberOrNull('thresholdRelativeViewPerformancePercent', defaultThresholds.thresholdRelativeViewPerformancePercent),
            thresholdRelativeViewMetric: data['thresholdRelativeViewMetric'] ?? defaultThresholds.thresholdRelativeViewMetric,
            thresholdViewsTimeWindowHours: getNumberOrNull('thresholdViewsTimeWindowHours', defaultThresholds.thresholdViewsTimeWindowHours),
            thresholdLikesTimeWindowHours: getNumberOrNull('thresholdLikesTimeWindowHours', defaultThresholds.thresholdLikesTimeWindowHours),
            thresholdCommentsTimeWindowHours: getNumberOrNull('thresholdCommentsTimeWindowHours', defaultThresholds.thresholdCommentsTimeWindowHours),
        };
        
        const rawFilterChannels = data['filterChannels'];
        console.log("[AlertStore] fetchPreferences: rawFilterChannels from API:", rawFilterChannels);
        const newFilters = {
            // Ensure filterChannels is the default JSON structure if the fetched value is empty or invalid
            filterChannels: (rawFilterChannels && typeof rawFilterChannels === 'string' && rawFilterChannels.trim() !== '' && rawFilterChannels.trim().startsWith('{')) 
                            ? rawFilterChannels 
                            : defaultFilters.filterChannels,
        };
        console.log("[AlertStore] fetchPreferences: newFilters to be set:", newFilters);

        // --- DEBUG LOG 2: Log state object before setting ---
        console.log("[fetchPreferences] Parsed thresholds state:", newThresholds);
        console.log("[fetchPreferences] Parsed filters state:", newFilters);

        set({
          thresholds: newThresholds,
          filters: newFilters,
          isLoading: false,
        });
      } catch (error: any) {
        console.error("Failed to fetch alert preferences:", error);
        toast({ title: "Error Loading Preferences", description: error.response?.data?.message || error.message, variant: "destructive" });
        set({ isLoading: false, thresholds: defaultThresholds, filters: defaultFilters }); // Fallback to defaults on error
      }
    },

    // --- Set Field Actions ---
    setThresholdField: (field, value) => {
      set(state => {
        if (!state.thresholds) return {};

        let processedValue: number | string | null;
        // Define which fields are numeric and nullable
        const nullableNumericFields: (keyof ThresholdPreferences)[] = [
            'thresholdRelativeViewPerformancePercent',
            'thresholdViewsTimeWindowHours',
            'thresholdLikesTimeWindowHours',
            'thresholdCommentsTimeWindowHours'
        ];

        // Check if the current field is one of the nullable numeric ones
        if (nullableNumericFields.includes(field as any)) { // Use `as any` for simplicity here
            // Allow empty string to represent null for optional numeric fields
            processedValue = value.trim() === '' ? null : (parseInt(value, 10) || null);
        } else if (field === 'thresholdRelativeViewMetric') {
            // Handle the string metric field
            processedValue = value;
        } else {
            // Handle mandatory numeric fields (Views, Likes, Comments, Velocity)
            // Treat empty string as 0 for compatibility/simplicity, or could use null if backend allows
            processedValue = parseInt(value, 10) || 0;
        }

        return {
            thresholds: {
                ...state.thresholds,
                [field]: processedValue
            }
        };
      });
    },
    // --- REMOVED setThresholdTimeWindowMetrics ---

    setFilterField: (field, value) => {
      set(state => ({
        filters: state.filters ? { ...state.filters, [field]: value } : null
      }));
    },

    // --- Save Actions ---
    saveThresholds: async (token) => {
      const { thresholds, filters } = get(); // Get both thresholds and filters
      if (!token || !thresholds || !filters) { 
        console.error("[AlertStore] saveThresholds: Aborted - Missing token, thresholds, or filters.");
        return;
      }
      set({ isSavingThresholds: true });

      console.log("[AlertStore] saveThresholds: Current filters.filterChannels from store:", filters.filterChannels);

      // Prepare payload using camelCase keys (assuming backend prefers this)
      const payload = {
          // Thresholds (camelCase)
          thresholdViews: thresholds.thresholdViews,
          thresholdLikes: thresholds.thresholdLikes,
          thresholdComments: thresholds.thresholdComments,
          thresholdVelocity: thresholds.thresholdVelocity,
          thresholdRelativeViewPerformancePercent: thresholds.thresholdRelativeViewPerformancePercent,
          thresholdRelativeViewMetric: thresholds.thresholdRelativeViewMetric,
          thresholdViewsTimeWindowHours: thresholds.thresholdViewsTimeWindowHours,
          thresholdLikesTimeWindowHours: thresholds.thresholdLikesTimeWindowHours,
          thresholdCommentsTimeWindowHours: thresholds.thresholdCommentsTimeWindowHours,
          // Filters (camelCase)
          filterChannels: filters.filterChannels,
      };
      console.log("Saving Preferences Payload (camelCase):", payload); // Updated log message

      try {
          await axios.put(
              `${BACKEND_API_BASE_URL}/users/alert-preferences`,
              payload, // Send camelCase payload
              { headers: { 'Authorization': `Bearer ${token}` } }
          );
          toast({ title: "Preferences Saved", description: "Alert preferences updated successfully." }); // Updated toast
      } catch (error: any) {
          toast({ title: "Save Failed", description: error.response?.data?.message || "Failed to save preferences.", variant: "destructive" }); // Updated toast
          console.error("Save preferences error:", error.response?.data || error);
      } finally {
          set({ isSavingThresholds: false });
      }
    },

    // --- Reset Actions (with immediate save) ---
    resetThresholds: async (token) => {
        const currentThresholds = get().thresholds; // Store current for potential revert on error
        const currentFilters = get().filters; // Get current filters too
        set({ isResettingThresholds: true, thresholds: defaultThresholds, filters: defaultFilters }); // Reset both in state

        if (!token) {
            toast({ title: "Reset Error", description: "Cannot save reset: missing token.", variant: "destructive" });
            set({ isResettingThresholds: false });
            return;
        }

        // Prepare payload with defaults for both thresholds and filters
        const payload = {
             // Thresholds (camelCase)
             thresholdViews: defaultThresholds.thresholdViews,
             thresholdLikes: defaultThresholds.thresholdLikes,
             thresholdComments: defaultThresholds.thresholdComments,
             thresholdVelocity: defaultThresholds.thresholdVelocity,
             thresholdRelativeViewPerformancePercent: defaultThresholds.thresholdRelativeViewPerformancePercent,
             thresholdRelativeViewMetric: defaultThresholds.thresholdRelativeViewMetric,
             thresholdViewsTimeWindowHours: defaultThresholds.thresholdViewsTimeWindowHours,
             thresholdLikesTimeWindowHours: defaultThresholds.thresholdLikesTimeWindowHours,
             thresholdCommentsTimeWindowHours: defaultThresholds.thresholdCommentsTimeWindowHours,
             // Filters (camelCase)
             filterChannels: defaultFilters.filterChannels,
        };

        try {
            await axios.put(
                `${BACKEND_API_BASE_URL}/users/alert-preferences`,
                payload, // Send default threshold data including new fields
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast({ title: "Preferences Reset & Saved", description: "Alert preferences reset to defaults and saved." }); // Updated toast
        } catch (error: any) {
            toast({ title: "Save Failed", description: error.response?.data?.message || "Failed to save reset preferences.", variant: "destructive" }); // Updated toast
            console.error("Save reset preferences error:", error.response?.data || error);
            // Optionally revert: set({ thresholds: currentThresholds, filters: currentFilters });
        } finally {
            set({ isResettingThresholds: false });
        }
    },
  }
})); 