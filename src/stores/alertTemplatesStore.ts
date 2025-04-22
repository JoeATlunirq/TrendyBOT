import { create } from 'zustand';
import axios from 'axios';
import { toast } from '@/components/ui/use-toast'; // Assuming useToast is available globally or adjust import

// Define type for templates state (can be shared or redefined)
type AlertTemplatesData = {
    templateTelegram: string;
    templateDiscord: string;
    templateEmailSubject: string;
    templateEmailPreview: string;
};

// Column Names (match backend .env/NocoDB and AlertTemplates.tsx)
const TEMPLATE_TELEGRAM_COLUMN = 'alert_template_telegram';
const TEMPLATE_DISCORD_COLUMN = 'alert_template_discord';
const TEMPLATE_EMAIL_SUBJECT_COLUMN = 'alert_template_email_subject';
const TEMPLATE_EMAIL_PREVIEW_COLUMN = 'alert_template_email_preview';

// Default Templates (as fallback)
const defaultTemplates: AlertTemplatesData = {
    templateTelegram: `🔥 TRENDING: {video_title}

📈 {views} views • {likes} likes • {comments} comments

👤 {channel_name}

🕒 Posted {time_ago}

👉 {video_url}`,
    templateDiscord: `**🔥 TRENDING VIDEO ALERT 🔥**

**Title:** {video_title}
**Channel:** {channel_name}

**Stats:** 📈 {views} views | 👍 {likes} likes | 💬 {comments} comments
**Posted:** {time_ago}

{video_url}`,
    templateEmailSubject: "🔥 New Trending Shorts Alert from Trendy",
    templateEmailPreview: "A new video is trending: {video_title}"
};

// Determine API URL (similar to AlertTemplates.tsx)
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api'; 
  } else {
    return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';
  }
};
const BACKEND_API_BASE_URL = getApiBaseUrl();

// Mapping from state key to DB column key
const keyMap: { [K in keyof AlertTemplatesData]: string } = {
    templateTelegram: TEMPLATE_TELEGRAM_COLUMN,
    templateDiscord: TEMPLATE_DISCORD_COLUMN,
    templateEmailSubject: TEMPLATE_EMAIL_SUBJECT_COLUMN,
    templateEmailPreview: TEMPLATE_EMAIL_PREVIEW_COLUMN,
};

// Define the store's state shape
interface AlertTemplatesState {
  templates: AlertTemplatesData | null;
  initialTemplates: AlertTemplatesData | null; // Store initial state for comparison
  isLoading: boolean;
  isSaving: boolean;
  isResetting: { [K in keyof AlertTemplatesData]?: boolean }; // Track loading state per field
  actions: {
    fetchTemplates: (token: string | null) => Promise<void>;
    setTemplateField: (field: keyof AlertTemplatesData, value: string) => void;
    resetTemplateField: (field: keyof AlertTemplatesData, token: string | null) => Promise<void>; // Pass token
    saveTemplates: (token: string | null) => Promise<void>;
  };
}

// Create the Zustand store
export const useAlertTemplatesStore = create<AlertTemplatesState>((set, get) => ({
  templates: null,
  initialTemplates: null,
  isLoading: true,
  isSaving: false,
  isResetting: {}, // Initialize resetting state
  actions: {
    // --- Fetch Templates Action ---
    fetchTemplates: async (token) => {
      if (!token) {
        set({ isLoading: false, templates: defaultTemplates, initialTemplates: defaultTemplates });
        return;
      }
      set({ isLoading: true });
      try {
        const response = await axios.get(`${BACKEND_API_BASE_URL}/users/alert-templates`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const fetchedTemplates = {
          templateTelegram: response.data[TEMPLATE_TELEGRAM_COLUMN] || defaultTemplates.templateTelegram,
          templateDiscord: response.data[TEMPLATE_DISCORD_COLUMN] || defaultTemplates.templateDiscord,
          templateEmailSubject: response.data[TEMPLATE_EMAIL_SUBJECT_COLUMN] || defaultTemplates.templateEmailSubject,
          templateEmailPreview: response.data[TEMPLATE_EMAIL_PREVIEW_COLUMN] || defaultTemplates.templateEmailPreview,
        };
        set({ templates: fetchedTemplates, initialTemplates: fetchedTemplates, isLoading: false });
      } catch (error: any) {
        console.error("Failed to fetch alert templates:", error);
        toast({ title: "Error Loading Templates", description: error.response?.data?.message || error.message, variant: "destructive" });
        set({ templates: defaultTemplates, initialTemplates: defaultTemplates, isLoading: false });
      }
    },

    // --- Set Template Field Action ---
    setTemplateField: (field, value) => {
      set(state => ({
        templates: state.templates ? { ...state.templates, [field]: value } : null
      }));
    },

    // --- Reset Template Field Action (MODIFIED to save immediately) ---
    resetTemplateField: async (field, token) => {
      const defaultValue = defaultTemplates[field];
      const currentTemplates = get().templates;

      // Set loading state for this specific field
      set(state => ({ isResetting: { ...state.isResetting, [field]: true } }));

      // Update local state immediately for visual feedback
      set(state => ({
        templates: state.templates ? { ...state.templates, [field]: defaultValue } : null
      }));
      
      if (!token || !currentTemplates) {
        toast({ title: "Reset Error", description: "Cannot save reset: missing token or template data.", variant: "destructive"});
        set(state => ({ isResetting: { ...state.isResetting, [field]: false } }));
        return;
      }

      // Prepare payload for the single field
      const dbColumn = keyMap[field];
      const payload = { [dbColumn]: defaultValue };

      console.log(`Saving reset for ${field} to backend:`, payload);

      try {
        await axios.put(
          `${BACKEND_API_BASE_URL}/users/alert-templates`,
          payload,
          { headers: { 'Authorization': `Bearer ${token}` }}
        );
        toast({ title: "Template Reset & Saved", description: `${field} reset to default and saved.` });
        
        // Update initialTemplates to reflect the saved default value for this field
        set(state => ({ 
          initialTemplates: state.initialTemplates ? { ...state.initialTemplates, [field]: defaultValue } : null,
          isResetting: { ...state.isResetting, [field]: false } // Clear loading state for this field
        }));

      } catch (error: any) {
        const message = error.response?.data?.message || `Failed to save reset for ${field}.`;
        toast({ title: "Save Failed", description: message, variant: "destructive" });
        console.error(`Save reset error for ${field}:`, error.response?.data || error);
        // Optionally revert local state change on error?
        // set(state => ({ templates: currentTemplates })); // Revert local change
        set(state => ({ isResetting: { ...state.isResetting, [field]: false } })); // Clear loading state
      }
    },

    // --- Save Templates Action ---
    saveTemplates: async (token) => {
      const { templates, initialTemplates } = get(); // Get current state from store

      if (!token || !templates || !initialTemplates) {
          console.error("Save prerequisites not met:", { token, templates, initialTemplates });
          toast({ title: "Save Error", description: "Cannot save templates: missing token or template data.", variant: "destructive"});
          return;
      }
      set({ isSaving: true });

      const payload: Partial<Record<string, string>> = {};
      let hasChanges = false;

      (Object.keys(templates) as Array<keyof AlertTemplatesData>).forEach((key) => {
        if (templates[key] !== initialTemplates[key]) {
          payload[keyMap[key]] = templates[key];
          hasChanges = true;
        }
      });

      if (!hasChanges) {
        toast({ title: "No Changes", description: "You haven't made any changes to save." });
        set({ isSaving: false });
        return;
      }

      console.log("Sending changed payload to backend:", payload);

      try {
        const response = await axios.put(
          `${BACKEND_API_BASE_URL}/users/alert-templates`,
          payload,
          { headers: { 'Authorization': `Bearer ${token}` }}
        );
        toast({ title: "Templates Saved", description: response.data?.message || "Alert templates updated successfully." });
        // Update initial state in the store to reflect the saved state
        set({ initialTemplates: templates, isSaving: false });
      } catch (error: any) {
        const message = error.response?.data?.message || "Failed to save templates.";
        toast({ title: "Save Failed", description: message, variant: "destructive" });
        console.error("Save templates error:", error.response?.data || error);
        set({ isSaving: false });
      }
    }
  }
}));

// Optional: Selector for actions to prevent unnecessary re-renders if actions object reference changes
// export const useAlertTemplatesActions = () => useAlertTemplatesStore(state => state.actions);
