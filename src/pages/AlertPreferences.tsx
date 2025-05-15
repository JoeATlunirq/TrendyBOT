import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Filter, TrendingUp, Trash2, PlusCircle, BellRing, BellOff } from 'lucide-react';
import { useAlertPreferencesStore } from '@/stores/alertPreferencesStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import axios from 'axios';
import { toast } from "@/components/ui/use-toast";

const PREDEFINED_ICONS = ['🎉', '💡', '🚀', '🎯', '📈', '📊', '💰', '🎮', '🎵', '🎨', '🧑‍💻', '✍️', '🔬', '📚', '✨', '🔥', '⭐', '❤️', '👍', '🤔'];

// Interface for a channel group
interface ChannelGroup {
  id: string; 
  name: string;
  channelIdsString: string; // Raw input from textarea
  icon?: string; 
  notificationsEnabled?: boolean;
  resolvedChannels?: Array<{ // NEW: To store resolved ID, name, and PFP URL
    id: string;
    name?: string;
    pfpUrl?: string;
  }>;
  thresholds?: StoredGroupThresholds; // NEW for per-group thresholds
}

// --- NEW: PFP State Interface ---
interface PfpState {
  url: string | null;
  isLoading: boolean;
  error?: boolean;
  channelName?: string; // Store channel name as well for tooltip/alt text
}
// --- END NEW ---

// --- NEW: Interface for per-group thresholds ---
interface StoredGroupThresholds {
    thresholdViews?: number | null;
    thresholdViewsTimeWindowHours?: number | null;
    thresholdLikes?: number | null;
    thresholdLikesTimeWindowHours?: number | null;
    thresholdComments?: number | null;
    thresholdCommentsTimeWindowHours?: number | null;
    thresholdVelocity?: number | null;
    thresholdRelativeViewPerformancePercent?: number | null;
    thresholdRelativeViewMetric?: '7d_avg_views' | '14d_avg_views' | '30d_avg_views' | '' | null; // Allow empty string for 'Select avg...' state
}
// --- END NEW ---

// Expected structure for the JSON in NocoDB
interface StoredChannelGroups {
  groups: Array<{
    id: string;
    name: string;
    icon?: string; 
    notificationsEnabled?: boolean;
    resolvedChannels?: Array<{
        id: string;
        name?: string;
        pfpUrl?: string;
    }>;
    thresholds?: StoredGroupThresholds; // NEW for per-group thresholds
  }>;
}

const AlertPreferences = () => {
    const { token } = useAuth();
    
    const thresholds = useAlertPreferencesStore(state => state.thresholds);
    const filters = useAlertPreferencesStore(state => state.filters);
    const isLoading = useAlertPreferencesStore(state => state.isLoading);
    const isSaving = useAlertPreferencesStore(state => state.isSavingThresholds);
    const isResetting = useAlertPreferencesStore(state => state.isResettingThresholds);
    const {
        fetchPreferences,
        setThresholdField,
        setFilterField,
        saveThresholds,
        resetThresholds
    } = useAlertPreferencesStore(state => state.actions);

    // Local state for managing channel groups
    const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([]);
    const [channelPfps, setChannelPfps] = useState<Record<string, PfpState>>({}); // Will be deprecated/simplified
    const [editingThresholdsForGroupId, setEditingThresholdsForGroupId] = useState<string | null>(null); // NEW: For Step 2
    const [isCurrentlySavingAll, setIsCurrentlySavingAll] = useState(false); // <<< NEW: Local state for overall save operation

    // Define getApiBaseUrl and BACKEND_API_BASE_URL once, early
    const getApiBaseUrl = () => { 
        if (import.meta.env.PROD) return '/api';
        return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';
    };
    const BACKEND_API_BASE_URL = getApiBaseUrl();

    // Fetch preferences on mount and when token changes
    useEffect(() => {
        if (token) {
        fetchPreferences(token);
        }
        // If no token, fetchPreferences in the store handles setting defaults and isLoading to false.
        // So, calling it with null or undefined token is also a valid scenario handled by the store.
        else {
            fetchPreferences(null); 
        }
    }, [token, fetchPreferences]);

    // Parse stored JSON from filters.filterChannels on load/change
    useEffect(() => {
        // filters is initialized in the store, and isLoading is a boolean.
        // filters.filterChannels is now guaranteed by the store to be a non-empty string,
        // ideally a valid JSON (either default or fetched).
        
        // Log what's coming from the store
        console.log("[AlertPreferences] useEffect[filters, isLoading]: isLoading:", isLoading, "filters?.filterChannels:", filters?.filterChannels);

        if (isLoading || !filters || !filters.filterChannels) {
            // If still loading, or if somehow filters/filterChannels is not set (defensive check),
            // and if channelGroups haven't been initialized yet, set a default UI state.
            if (isLoading && channelGroups.length === 0) {
                // setChannelGroups([{ id: `loading-default-${Date.now()}`, name: 'Loading Groups...', channelIdsString: '' }]);
                // Or simply return and let the loader icon handle it until isLoading is false.
            }
            return; 
        }

        try {
            const parsedData: StoredChannelGroups = JSON.parse(filters.filterChannels);
            console.log("[AlertPreferences] useEffect[filters, isLoading]: parsedData:", parsedData);

            if (parsedData && Array.isArray(parsedData.groups)) {
                if (parsedData.groups.length > 0) {
                    setChannelGroups(parsedData.groups.map(g => ({
                        id: g.id,
                        name: g.name,
                        channelIdsString: Array.isArray(g.resolvedChannels) && g.resolvedChannels.length > 0 
                                            ? g.resolvedChannels.map(rc => rc.id).join(', ') 
                                            : '',
                        icon: g.icon || '',
                        notificationsEnabled: g.notificationsEnabled === undefined ? true : g.notificationsEnabled, 
                        resolvedChannels: g.resolvedChannels || [],
                        thresholds: g.thresholds || { // NEW: Initialize thresholds
                            thresholdViews: null,
                            thresholdViewsTimeWindowHours: null,
                            thresholdLikes: null,
                            thresholdLikesTimeWindowHours: null,
                            thresholdComments: null,
                            thresholdCommentsTimeWindowHours: null,
                            thresholdVelocity: null,
                            thresholdRelativeViewPerformancePercent: null,
                            thresholdRelativeViewMetric: null,
                        } 
                    })));
                } else {
                    setChannelGroups([{ 
                        id: `default-empty-parsed-${Date.now()}`, 
                        name: 'Default Group', 
                        channelIdsString: '', 
                        icon: '', 
                        notificationsEnabled: true,
                        resolvedChannels: [],
                        thresholds: { // NEW: Default thresholds
                            thresholdViews: null,
                            thresholdViewsTimeWindowHours: null,
                            thresholdLikes: null,
                            thresholdLikesTimeWindowHours: null,
                            thresholdComments: null,
                            thresholdCommentsTimeWindowHours: null,
                            thresholdVelocity: null,
                            thresholdRelativeViewPerformancePercent: null,
                            thresholdRelativeViewMetric: null,
                        }
                    }]);
                }
            } else {
                setChannelGroups([{ 
                    id: `default-bad-structure-${Date.now()}`, 
                    name: 'Default Group', 
                    channelIdsString: '', 
                    icon: '', 
                    notificationsEnabled: true,
                    resolvedChannels: [],
                    thresholds: { // NEW: Default thresholds
                        thresholdViews: null,
                        thresholdViewsTimeWindowHours: null,
                        thresholdLikes: null,
                        thresholdLikesTimeWindowHours: null,
                        thresholdComments: null,
                        thresholdCommentsTimeWindowHours: null,
                        thresholdVelocity: null,
                        thresholdRelativeViewPerformancePercent: null,
                        thresholdRelativeViewMetric: null,
                    }
                }]);
            }
        } catch (error) {
            setChannelGroups([{ 
                id: `default-parse-error-${Date.now()}`, 
                name: 'Default Group (Error)', 
                channelIdsString: '', 
                icon: '', 
                notificationsEnabled: true,
                resolvedChannels: [],
                thresholds: { // NEW: Default thresholds
                    thresholdViews: null,
                    thresholdViewsTimeWindowHours: null,
                    thresholdLikes: null,
                    thresholdLikesTimeWindowHours: null,
                    thresholdComments: null,
                    thresholdCommentsTimeWindowHours: null,
                    thresholdVelocity: null,
                    thresholdRelativeViewPerformancePercent: null,
                    thresholdRelativeViewMetric: null,
                }
            }]);
        }
    }, [filters?.filterChannels, isLoading]);

    // NEW: useEffect to manage editingThresholdsForGroupId
    useEffect(() => {
        const alertEnabledGroups = channelGroups.filter(g => g.notificationsEnabled);
        if (alertEnabledGroups.length === 0) {
            setEditingThresholdsForGroupId(null);
            return;
        }

        const currentEditingGroup = channelGroups.find(g => g.id === editingThresholdsForGroupId);
        if (!currentEditingGroup || !currentEditingGroup.notificationsEnabled) {
            setEditingThresholdsForGroupId(alertEnabledGroups[0].id);
        } else {
            // If current selection is still valid and alert-enabled, keep it.
            // This handles cases where channelGroups re-orders but selection is still valid.
            if (!alertEnabledGroups.some(g => g.id === editingThresholdsForGroupId)) {
                 setEditingThresholdsForGroupId(alertEnabledGroups[0].id); // Fallback if current ID vanished
            }
        }
    }, [channelGroups, editingThresholdsForGroupId]);

    // --- ADJUSTED: useEffect to fetch PFPs for channels that might be missing them in resolvedChannels ---
    useEffect(() => {
        if (!token || channelGroups.length === 0) return;

        const fetchPfpAndNameForChannel = async (channelId: string, groupId: string) => {
            const group = channelGroups.find(g => g.id === groupId);
            const existingChannelData = group?.resolvedChannels?.find(rc => rc.id === channelId);
            if (existingChannelData && existingChannelData.pfpUrl && existingChannelData.name) return; // Already have PFP URL and name

            // If already errored (e.g. 429), don't retry immediately in this session for this channelId
            if (channelPfps[channelId]?.error) return; 
            if (channelPfps[channelId]?.isLoading) return;
            
            setChannelPfps(prev => ({ ...prev, [channelId]: { isLoading: true, url: null, error: false } })); // Reset error on new attempt

            try {
                const response = await axios.post(`${BACKEND_API_BASE_URL}/youtube/lookup`, 
                    { query: channelId }, 
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (response.data && response.data.id) { // Ensure ID matches, then update
                    const pfpData = {
                        id: response.data.id,
                        name: response.data.title || response.data.id,
                        pfpUrl: response.data.thumbnailUrl || null
                    };
                    setChannelGroups(prevGroups => prevGroups.map(g => {
                        if (g.id === groupId) {
                            const updatedResolved = g.resolvedChannels ? g.resolvedChannels.filter(rc => rc.id !== channelId) : [];
                            updatedResolved.push(pfpData);
                            return { ...g, resolvedChannels: updatedResolved };
                        }
                        return g;
                    }));
                    setChannelPfps(prev => ({ ...prev, [channelId]: { isLoading: false, url: pfpData.pfpUrl, channelName: pfpData.name } }));
                } else {
                    setChannelPfps(prev => ({ ...prev, [channelId]: { isLoading: false, url: null, error: true } }));
                }
            } catch (error) {
                console.error(`Failed to fetch PFP/name for ${channelId}:`, error);
                setChannelPfps(prev => ({ ...prev, [channelId]: { isLoading: false, url: null, error: true } }));
            }
        };

        channelGroups.forEach(group => {
            group.resolvedChannels?.forEach(rc => {
                if (rc.id && (!rc.pfpUrl || !rc.name)) { // If ID exists but PFP or name is missing
                    fetchPfpAndNameForChannel(rc.id, group.id);
                }
            });
            // Also check channelIdsString for any IDs not yet in resolvedChannels (e.g. newly typed)
            // This part is mostly handled by the save process now, but this ensures UI consistency if user types and doesn't save immediately.
            group.channelIdsString.split(',').map(id => id.trim()).filter(id => id.startsWith('UC') && id.length > 20).forEach(idInString => {
                const isInResolved = group.resolvedChannels?.some(rc => rc.id === idInString);
                if (!isInResolved) {
                    // This case is tricky: we don't want to spam fetches for merely typed IDs before save.
                    // The primary PFP/name fetch will now occur during the save/resolution process.
                    // This effect will now mainly ensure that *loaded* resolvedChannels have their PFP/name if missing.
                }
            });
        });
    }, [channelGroups, token, BACKEND_API_BASE_URL]); // Removed channelPfps from deps
    // --- END ADJUSTED PFP Fetch useEffect ---

    // NEW: Per-group threshold handlers
    const handleGroupThresholdInputChange = (groupId: string | null, fieldName: keyof StoredGroupThresholds, event: React.ChangeEvent<HTMLInputElement>) => {
        if (!groupId) return;
        const { value } = event.target;
        let processedValue: string | number | null = value;
        // Fields that should be numbers
        const numericFields: (keyof StoredGroupThresholds)[] = [
            'thresholdViews', 'thresholdViewsTimeWindowHours', 
            'thresholdLikes', 'thresholdLikesTimeWindowHours',
            'thresholdComments', 'thresholdCommentsTimeWindowHours',
            'thresholdVelocity', 'thresholdRelativeViewPerformancePercent'
        ];
        if (numericFields.includes(fieldName)) {
            processedValue = value === '' ? null : Number(value);
        }

        setChannelGroups(prev => 
            prev.map(group => 
                group.id === groupId 
                    ? { ...group, thresholds: { ...group.thresholds, [fieldName]: processedValue } as StoredGroupThresholds } 
                    : group
            )
        );
    };

    const handleGroupThresholdSelectChange = (groupId: string | null, fieldName: keyof StoredGroupThresholds, value: string) => {
        if (!groupId) return;
        setChannelGroups(prev => 
            prev.map(group => 
                group.id === groupId 
                    ? { ...group, thresholds: { ...group.thresholds, [fieldName]: value === '' ? null : value } as StoredGroupThresholds } 
                    : group
            )
        );
    };

    // Group Management Handlers
    const handleAddGroup = () => {
        setChannelGroups(prev => {
            const newGroup: ChannelGroup = {
                id: `new-${Date.now()}`, 
                name: 'New Group', 
                channelIdsString: '', 
                icon: '', 
                notificationsEnabled: true, 
                resolvedChannels: [],
                thresholds: { // NEW: Default thresholds for new group
                    thresholdViews: null,
                    thresholdViewsTimeWindowHours: null,
                    thresholdLikes: null,
                    thresholdLikesTimeWindowHours: null,
                    thresholdComments: null,
                    thresholdCommentsTimeWindowHours: null,
                    thresholdVelocity: null,
                    thresholdRelativeViewPerformancePercent: null,
                    thresholdRelativeViewMetric: null,
                }
            };
            const newState = [...prev, newGroup];
            return newState;
        });
    };

    const handleGroupNameChange = (groupId: string, newName: string) => {
        setChannelGroups(prev => prev.map(group => group.id === groupId ? { ...group, name: newName } : group));
    };

    const handleGroupChannelIdsChange = (groupId: string, newChannelIdsString: string) => {
        setChannelGroups(prev => prev.map(group => group.id === groupId ? { ...group, channelIdsString: newChannelIdsString } : group));
    };

    const handleGroupIconChange = (groupId: string, newIconValue: string) => {
        setChannelGroups(prev => prev.map(group => group.id === groupId ? { ...group, icon: newIconValue === "@none@" ? "" : newIconValue } : group));
    };

    const handleGroupNotificationToggle = (groupId: string, isEnabled: boolean) => {
        setChannelGroups(prev => prev.map(group => group.id === groupId ? { ...group, notificationsEnabled: isEnabled } : group));
    };

    const handleDeleteGroup = (groupId: string) => {
        setChannelGroups(prev => prev.filter(group => group.id !== groupId));
    };

    const handleSavePreferencesClick = async () => { // Made async
        setIsCurrentlySavingAll(true); // <<< SET LOADING STATE
        try { // <<< ADD TRY BLOCK
            if (!token && channelGroups.some(cg => cg.channelIdsString.trim() !== '')) {
                toast({
                    title: "Login Required for Resolution",
                    description: "Channel IDs/URLs can only be resolved if you are logged in. Please log in or save with existing IDs.",
                    variant: "destructive"
                });
                // Optionally, you could still save if you allow saving unresolved things without login
                // For now, let's prevent saving with things that *look* like they need resolution if not logged in.
                // However, if all channelIdStrings are empty or look like UC IDs, saving without login might be fine.
                const needsResolution = channelGroups.some(group => 
                    group.channelIdsString.split(',').some(entry => entry.trim() && (!entry.trim().startsWith('UC') || entry.trim().length <= 20))
                );
                if (needsResolution) return; 
            }

            let unresolvedEntriesExistGlobal = false;
            let resolutionErrorsOccurredGlobal = false;
            let actualApiLookupsAttempted = false;

            // Create a new array for updated groups to avoid direct state mutation in loop
            const updatedChannelGroups: ChannelGroup[] = JSON.parse(JSON.stringify(channelGroups)); // Deep copy

            for (let i = 0; i < updatedChannelGroups.length; i++) {
                const group = updatedChannelGroups[i];
                const currentResolvedMap = new Map(group.resolvedChannels?.map(rc => [rc.id, rc]));
                const newResolvedChannels: Array<{id: string; name?:string; pfpUrl?: string}> = [];

                if (!group.channelIdsString.trim()) {
                    group.resolvedChannels = []; // Clear resolved if string is empty
                    continue; 
                }

                const entries = group.channelIdsString.split(',').map(entry => entry.trim()).filter(entry => entry);

                for (const entry of entries) {
                    let channelId = entry;
                    let resolvedName: string | undefined = undefined;
                    let resolvedPfpUrl: string | undefined = undefined;
                    let needsLookup = true; // Assume lookup is needed by default

                    if (entry.startsWith('UC') && entry.length > 20) { // Basic check for existing Channel ID format
                        channelId = entry; // Ensure channelId is set to the entry if it's an ID
                        if (currentResolvedMap.has(entry)) {
                            const existingData = currentResolvedMap.get(entry)!;
                            if (existingData.name && existingData.pfpUrl) { // Check if name and PFP URL already exist
                                resolvedName = existingData.name;
                                resolvedPfpUrl = existingData.pfpUrl;
                                needsLookup = false; // No lookup needed if we have ID, name, and PFP
                            }
                        } // If it's an ID but not in currentResolvedMap, or missing name/pfp, lookup is still needed (needsLookup remains true)
                    } // If not in ID format, lookup is definitely needed (needsLookup remains true)
                    
                    if (needsLookup && token) { 
                        actualApiLookupsAttempted = true; // Mark that we intended to do a lookup
                        try {
                            const response = await axios.post(`${BACKEND_API_BASE_URL}/youtube/lookup`, 
                                { query: entry }, // Use original entry for lookup
                                { headers: { 'Authorization': `Bearer ${token}` } }
                            );
                            if (response.data && response.data.id) {
                                channelId = response.data.id; // Use resolved ID
                                resolvedName = response.data.title || response.data.id;
                                resolvedPfpUrl = response.data.thumbnailUrl || undefined;
                            } else {
                                unresolvedEntriesExistGlobal = true;
                                toast({ title: "Resolution Warning", description: `Group '${group.name}': Could not resolve '${entry}'. Kept original/ID.`, variant: "default", duration: 2000 });
                            }
                        } catch (error: any) {
                            unresolvedEntriesExistGlobal = true;
                            resolutionErrorsOccurredGlobal = true;
                            toast({ title: "Resolution Error", description: `Group '${group.name}': Failed to resolve '${entry}'.`, variant: "destructive" });
                        }
                    }
                    // Ensure channelId is a valid ID at this point if it was resolved
                    if (channelId.startsWith('UC') && channelId.length > 20) {
                        newResolvedChannels.push({ id: channelId, name: resolvedName, pfpUrl: resolvedPfpUrl });
                    } else if (entry.startsWith('UC') && entry.length > 20) {
                         newResolvedChannels.push({ id: entry }); // If lookup failed but original was an ID
                    } else {
                        // If entry wasn't an ID and couldn't be resolved to one, it's effectively dropped from resolvedChannels
                        // but remains in channelIdsString for user to see.
                    }
                }
                updatedChannelGroups[i].resolvedChannels = newResolvedChannels;
                // Update channelIdsString to reflect only the successfully resolved/validated IDs from newResolvedChannels
                updatedChannelGroups[i].channelIdsString = newResolvedChannels.map(rc => rc.id).join(', ');
            }
            
            // The channelGroups state already contains the most up-to-date thresholds for each group
            // as they are updated directly by handleGroupThresholdInputChange/SelectChange.
            // So, we use updatedChannelGroups (which is a deep copy of channelGroups with resolved IDs) 
            // directly for storing.
            setChannelGroups(updatedChannelGroups); // Update state with resolved PFP/name data and cleaned string

            const groupsToStore: StoredChannelGroups = {
                groups: updatedChannelGroups.map(cg => ({
                    id: cg.id,
                    name: cg.name,
                    icon: cg.icon || '', 
                    notificationsEnabled: cg.notificationsEnabled === undefined ? true : cg.notificationsEnabled,
                    resolvedChannels: cg.resolvedChannels || [],
                    thresholds: cg.thresholds || { // Ensure default thresholds if somehow missing
                        thresholdViews: null,
                        thresholdViewsTimeWindowHours: null,
                        thresholdLikes: null,
                        thresholdLikesTimeWindowHours: null,
                        thresholdComments: null,
                        thresholdCommentsTimeWindowHours: null,
                        thresholdVelocity: null,
                        thresholdRelativeViewPerformancePercent: null,
                        thresholdRelativeViewMetric: null,
                    }
                }))
            };
            const jsonStringToStore = JSON.stringify(groupsToStore);
            
            console.log("[AlertPreferences] handleSavePreferencesClick: jsonStringToStore BEFORE setFilterField:", jsonStringToStore);
            setFilterField('filterChannels', jsonStringToStore);
            
            // Call the original saveThresholds, which picks up the updated filters.filterChannels
            // saveThresholds(token) is an async action in the store, so we await it if we want to act after it completes.
            await saveThresholds(token); 

            // Final toast after saveThresholds has completed
            if (resolutionErrorsOccurredGlobal) {
                toast({ title: "Saved with Errors", description: "Preferences saved, but some channel inputs failed to resolve. Check notifications.", variant: "destructive" });
            } else if (unresolvedEntriesExistGlobal) {
                toast({ title: "Saved with Unresolved Inputs", description: "Preferences saved. Some channel inputs could not be resolved and were kept as entered.", variant: "default" });
            } else if (actualApiLookupsAttempted && !unresolvedEntriesExistGlobal && !resolutionErrorsOccurredGlobal){
                toast({ title: "Saved Successfully", description: "Preferences and all resolvable channel inputs saved." });
            } else { // No lookups attempted, or everything was already an ID
                toast({ title: "Saved Successfully", description: "Your preferences have been saved." });
            }
        } finally { // <<< ADD FINALLY BLOCK
            setIsCurrentlySavingAll(false); // <<< RESET LOADING STATE
        }
    };

    const handleResetPreferencesClick = () => {
        const defaultThresholds: StoredGroupThresholds = {
            thresholdViews: null,
            thresholdViewsTimeWindowHours: null,
            thresholdLikes: null,
            thresholdLikesTimeWindowHours: null,
            thresholdComments: null,
            thresholdCommentsTimeWindowHours: null,
            thresholdVelocity: null,
            thresholdRelativeViewPerformancePercent: null,
            thresholdRelativeViewMetric: null,
        };

        const resetGroups = channelGroups.map(group => ({
            ...group,
            // Reset thresholds for each group; keep other group details like name, icon, channels for a softer reset.
            // If a full reset to one 'Default Group' is desired, this part would be different.
            // For now, resetting only thresholds of existing groups.
            thresholds: { ...defaultThresholds }
        }));

        setChannelGroups(resetGroups);

        // Prepare the structure for NocoDB (which now includes these reset thresholds per group)
        const groupsToStoreOnReset: StoredChannelGroups = {
            groups: resetGroups.map(cg => ({
                id: cg.id,
                name: cg.name,
                icon: cg.icon || '', 
                notificationsEnabled: cg.notificationsEnabled === undefined ? true : cg.notificationsEnabled,
                resolvedChannels: cg.resolvedChannels || [],
                thresholds: cg.thresholds // These are now the defaultThresholds
            }))
        };
        const jsonStringToStore = JSON.stringify(groupsToStoreOnReset);
        
        setFilterField('filterChannels', jsonStringToStore); 
        // The old way of setting channelGroups to a single default group is changed.
        // We now keep the groups but reset their thresholds.
        // If you want to revert to a single group, that logic would be reinstated here.

        // The global thresholds in the store are less relevant now for per-group settings.
        // resetThresholds(token) might reset some global defaults in the store if they exist,
        // but the primary action here is updating filterChannels with reset per-group thresholds.
        resetThresholds(token); 
    };

    if (isLoading && !channelGroups.length) { // Show loader if loading and groups not yet parsed
        return <div className="container mx-auto py-8 px-4 md:px-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    // Check if thresholds or filters are null (they might be initially null from store before fetch)
    if (!thresholds || !filters) {
         return <div className="container mx-auto py-8 px-4 md:px-6 text-center text-red-400">Failed to load alert preferences. Please ensure the store is initialized and try refreshing.</div>;
    }

    const getNullableInputValue = (value: number | null | undefined): string => {
        return value === null || value === undefined ? '' : String(value);
    }

    const activeGroupForThresholds = channelGroups.find(g => g.id === editingThresholdsForGroupId);
    const currentThresholds = activeGroupForThresholds?.thresholds;

    // --- NEW: Fallback Avatar Generator ---
    const generateFallbackAvatar = (name: string | undefined) => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'ID')}&background=555555&color=eeeeee&bold=true&size=32`;
    };
    // --- END NEW ---

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white font-orbitron">Alert Preferences</h1>
                <p className="text-neutral-400">Define content scope by grouping channels, then set alert conditions for those groups.</p>
            </div>

            <div className="space-y-8">
                {/* Filters Section (Step 1) - Revised for Compact Group Management */}
                <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                             <Filter className="h-5 w-5 text-trendy-yellow" />
                             <CardTitle className="text-white font-orbitron">Step 1: Define Channel Groups</CardTitle>
                        </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">Group YouTube channels by niche or interest for targeted monitoring and research. Input channel URLs, names, or IDs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {channelGroups.map((group, index) => (
                            <div key={group.id} className="p-4 border border-neutral-600/80 rounded-lg bg-neutral-700/20 space-y-3 hover:border-neutral-500/80 transition-colors duration-200">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-grow space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={group.icon || "@none@"}
                                                onValueChange={(newIconValue) => handleGroupIconChange(group.id, newIconValue)}
                                            >
                                                <SelectTrigger 
                                                    id={`group-icon-select-${group.id}`}
                                                    className="w-[80px] bg-transparent border-0 border-b-2 border-neutral-600 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 p-1 focus:border-trendy-yellow text-white"
                                                >
                                                    <SelectValue placeholder="Icon" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-200 max-h-60">
                                                    <SelectItem value="@none@" className="hover:bg-neutral-600">No Icon</SelectItem>
                                                    {PREDEFINED_ICONS.map(icon => (
                                                        <SelectItem key={icon} value={icon} className="hover:bg-neutral-600 text-lg">
                                                            {icon}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                            <Input
                                                id={`group-name-${group.id}`}
                                                placeholder="Enter Group Name (e.g., Gaming Niche)"
                                                value={group.name}
                                                onChange={(e) => handleGroupNameChange(group.id, e.target.value)}
                                                className="text-md font-medium bg-transparent border-0 border-b-2 border-neutral-600 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 p-1 focus:border-trendy-yellow text-white placeholder:text-neutral-400/70 flex-grow"
                                            />
                                        </div>
                                        {/* NEW: Notification Toggle for the group */}
                                        <div className="flex items-center justify-between pt-1">
                                            <Label htmlFor={`group-notifications-${group.id}`} className="text-xs text-neutral-400 flex items-center">
                                                {group.notificationsEnabled ? 
                                                    <BellRing className="h-3.5 w-3.5 mr-1.5 text-trendy-yellow" /> : 
                                                    <BellOff className="h-3.5 w-3.5 mr-1.5 text-neutral-500" />
                                                }
                                                Alert Notifications for this group
                                            </Label>
                                            <Switch
                                                id={`group-notifications-${group.id}`}
                                                checked={group.notificationsEnabled === undefined ? true : group.notificationsEnabled}
                                                onCheckedChange={(checked) => handleGroupNotificationToggle(group.id, checked)}
                                                className="data-[state=checked]:bg-trendy-yellow data-[state=unchecked]:bg-neutral-600 scale-90"
                                            />
                                        </div>
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDeleteGroup(group.id)}
                                        className="text-neutral-500 hover:text-red-500 hover:bg-red-900/20 p-1 h-auto w-auto shrink-0"
                                        disabled={channelGroups.length <= 1} // Simpler: disable if only one group exists
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <div>
                                    <Label htmlFor={`group-channels-${group.id}`} className="text-neutral-300 block mb-1.5 text-xs">
                                        YouTube Channel URLs, Names, or IDs (comma-separated)
                                    </Label>
                                    <Textarea
                                        id={`group-channels-${group.id}`}
                                        placeholder="UCxxxxxxxxxxxxxxxxx, youtube.com/@handle, CoolChannelName, ..."
                                        value={group.channelIdsString}
                                        onChange={(e) => handleGroupChannelIdsChange(group.id, e.target.value)}
                                        className="bg-neutral-700/50 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow min-h-[50px] text-sm"
                                        rows={2}
                                    />
                                     {/* --- NEW: Display PFPs from resolvedChannels --- */}
                                     {group.resolvedChannels && group.resolvedChannels.length > 0 ? (
                                        <div className="mt-2 space-y-1">
                                            <p className="text-xs text-neutral-400">Linked Channels (PFPs):</p>
                                            <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
                                                {group.resolvedChannels.map(rc => {
                                                    const pfpState = channelPfps[rc.id]; // Still use this for global loading/error state from the secondary fetch effect
                                                    if (pfpState?.isLoading) {
                                                        return <Loader2 key={`pfp-loader-${rc.id}`} className="w-8 h-8 text-neutral-500 animate-spin" />;
                                                    }
                                                    if (rc.pfpUrl) {
                                                        return <img key={`pfp-${rc.id}`} src={rc.pfpUrl} alt={rc.name || rc.id} title={rc.name || rc.id} className="w-8 h-8 rounded-full border border-neutral-500 object-cover" />;
                                                    }
                                                    // Fallback if pfpUrl is not in resolvedChannels or if secondary fetch errored
                                                    return <img key={`pfp-fallback-${rc.id}`} src={generateFallbackAvatar(rc.name || rc.id.substring(0,2))} alt={`Fallback for ${rc.id}`} title={rc.name || rc.id} className="w-8 h-8 rounded-full border border-neutral-600" />;
                                                })}
                                            </div>
                                        </div>
                                     ) : group.channelIdsString.trim() ? (
                                        <div className="mt-2"><p className="text-xs text-neutral-500">Enter valid Channel IDs/URLs and save to see PFPs.</p></div>
                                     ) : null}
                                     {/* --- END NEW: Display PFPs --- */}
                                </div>
                        </div>
                        ))}
                        <Button onClick={handleAddGroup} variant="outline" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white w-full sm:w-auto mt-2">
                            <PlusCircle className="h-4 w-4 mr-2" /> Add New Group
                        </Button>
                        <p className="text-xs text-neutral-500/90 mt-3 pl-1">Channel group configurations are saved together with your alert conditions using the button at the bottom of the page.</p>
                    </CardContent>
                </Card>

                 {/* Thresholds Section (Step 2) - No changes here for now, but it applies to alerts for ANY group that meets criteria */}
                <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                         <div className="flex items-center gap-2">
                             <TrendingUp className="h-5 w-5 text-trendy-yellow" />
                             <CardTitle className="text-white font-orbitron">
                                {activeGroupForThresholds ? `Step 2: Alert Conditions for "${activeGroupForThresholds.name}"` : 'Step 2: Set Alert Conditions'}
                             </CardTitle>
                         </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">
                            {channelGroups.filter(g => g.notificationsEnabled).length > 0 
                                ? 'Select a notification-enabled group below to configure its specific alert thresholds.' 
                                : 'Enable notifications for at least one group in Step 1 to configure its alerts.'}
                        </CardDescription>
                        {/* Dropdown was here, now removed from CardHeader */}
                    </CardHeader>
                    <CardContent className={`grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8 ${!activeGroupForThresholds && channelGroups.filter(g => g.notificationsEnabled).length > 0 ? 'pt-4' : ''} ${!activeGroupForThresholds ? 'items-center justify-center' :''}`}>
                        {/* NEW: Dropdown moved to top of CardContent */} 
                        {channelGroups.filter(g => g.notificationsEnabled).length > 0 && (
                            <div className="lg:col-span-2 mb-6">
                                <Label htmlFor="group-alert-selector" className="text-sm text-neutral-300 mb-1.5 block font-medium">Configure alerts for group:</Label>
                                <Select 
                                    value={editingThresholdsForGroupId || ''} 
                                    onValueChange={(value) => setEditingThresholdsForGroupId(value || null)}
                                >
                                    <SelectTrigger id="group-alert-selector" className="w-full sm:w-[350px] bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow">
                                        <SelectValue placeholder="Select a group..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-800 border-neutral-600 text-white">
                                        {channelGroups.filter(g => g.notificationsEnabled).map(group => (
                                            <SelectItem key={group.id} value={group.id} className="hover:bg-neutral-700 focus:bg-neutral-700 cursor-pointer">
                                                <div className="flex items-center">
                                                    {group.icon && <span className="mr-2 text-lg">{group.icon}</span>}
                                                    {group.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                         
                        {/* Instructional text based on state */} 
                        {!activeGroupForThresholds && channelGroups.filter(g => g.notificationsEnabled).length > 0 && (
                            <div className="lg:col-span-2 text-center py-6">
                                <p className="text-neutral-400 text-sm">Select a group from the dropdown above to configure its specific alert settings.</p>
                            </div>
                        )}
                        {!activeGroupForThresholds && channelGroups.filter(g => g.notificationsEnabled).length === 0 && (
                             <div className="lg:col-span-2 text-center py-6">
                                <p className="text-neutral-400 text-sm">Enable "Alert Notifications" for at least one group in Step 1 to set up its alert conditions here.</p>
                            </div>
                        )}

                        {/* Views - Conditionally render or style based on activeGroupForThresholds */} 
                        <div className={`space-y-2 ${!activeGroupForThresholds ? 'hidden' : ''}`}> 
                            <Label htmlFor="thresholdViews" className="text-neutral-300">Views Threshold</Label>
                            <div className="flex gap-3 items-center">
                                <Input
                                    id="thresholdViews"
                                    name="thresholdViews"
                                    type="number"
                                    placeholder="e.g., 10000"
                                    value={getNullableInputValue(currentThresholds?.thresholdViews)}
                                    onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdViews', e)}
                                    className="flex-grow bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    disabled={!activeGroupForThresholds}
                                />
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <Label htmlFor="thresholdViewsTimeWindowHours" className="text-xs text-neutral-400">Within</Label>
                                    <Input
                                        id="thresholdViewsTimeWindowHours"
                                        name="thresholdViewsTimeWindowHours"
                                        type="number"
                                        placeholder="Hours"
                                        value={getNullableInputValue(currentThresholds?.thresholdViewsTimeWindowHours)}
                                        onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdViewsTimeWindowHours', e)}
                                        className="w-20 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-xs p-2"
                                        disabled={!activeGroupForThresholds}
                                    />
                                     <span className="text-xs text-neutral-400">Hrs</span>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Min views required. Optionally set time limit (hours after posting).</p>
                        </div>
                        {/* Likes - Conditionally render or style based on activeGroupForThresholds */} 
                        <div className={`space-y-2 ${!activeGroupForThresholds ? 'hidden' : ''}`}> 
                            <Label htmlFor="thresholdLikes" className="text-neutral-300">Likes Threshold</Label>
                             <div className="flex gap-3 items-center">
                                <Input
                                    id="thresholdLikes"
                                    name="thresholdLikes"
                                    type="number"
                                    placeholder="e.g., 1000"
                                    value={getNullableInputValue(currentThresholds?.thresholdLikes)}
                                    onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdLikes', e)}
                                    className="flex-grow bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    disabled={!activeGroupForThresholds}
                                />
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <Label htmlFor="thresholdLikesTimeWindowHours" className="text-xs text-neutral-400">Within</Label>
                                    <Input
                                        id="thresholdLikesTimeWindowHours"
                                        name="thresholdLikesTimeWindowHours"
                                        type="number"
                                        placeholder="Hours"
                                        value={getNullableInputValue(currentThresholds?.thresholdLikesTimeWindowHours)}
                                        onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdLikesTimeWindowHours', e)}
                                        className="w-20 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-xs p-2"
                                        disabled={!activeGroupForThresholds}
                                    />
                                     <span className="text-xs text-neutral-400">Hrs</span>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Min likes required. Optionally set time limit (hours after posting).</p>
                        </div>
                         {/* Comments - Conditionally render or style based on activeGroupForThresholds */} 
                         <div className={`space-y-2 ${!activeGroupForThresholds ? 'hidden' : ''}`}> 
                            <Label htmlFor="thresholdComments" className="text-neutral-300">Comments Threshold</Label>
                             <div className="flex gap-3 items-center">
                                <Input
                                    id="thresholdComments"
                                    name="thresholdComments"
                                    type="number"
                                    placeholder="e.g., 100"
                                    value={getNullableInputValue(currentThresholds?.thresholdComments)}
                                    onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdComments', e)}
                                    className="flex-grow bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    disabled={!activeGroupForThresholds}
                                />
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <Label htmlFor="thresholdCommentsTimeWindowHours" className="text-xs text-neutral-400">Within</Label>
                                    <Input
                                        id="thresholdCommentsTimeWindowHours"
                                        name="thresholdCommentsTimeWindowHours"
                                        type="number"
                                        placeholder="Hours"
                                        value={getNullableInputValue(currentThresholds?.thresholdCommentsTimeWindowHours)}
                                        onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdCommentsTimeWindowHours', e)}
                                        className="w-20 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-xs p-2"
                                        disabled={!activeGroupForThresholds}
                                    />
                                    <span className="text-xs text-neutral-400">Hrs</span>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Min comments required. Optionally set time limit (hours after posting).</p>
                        </div>
                         {/* Velocity - Conditionally render or style based on activeGroupForThresholds */} 
                         <div className={`space-y-2 ${!activeGroupForThresholds ? 'hidden' : ''}`}> 
                            <Label htmlFor="thresholdVelocity" className="text-neutral-300">Engagement Velocity (Views/Hour)</Label>
                            <Input
                                id="thresholdVelocity"
                                name="thresholdVelocity"
                                type="number"
                                value={getNullableInputValue(currentThresholds?.thresholdVelocity)}
                                onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdVelocity', e)}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                disabled={!activeGroupForThresholds}
                            />
                             <p className="text-xs text-neutral-500">Minimum views gained per hour.</p>
                        </div>

                        {/* Relative Performance - Conditionally render or style based on activeGroupForThresholds */} 
                        <div className={`space-y-4 p-4 rounded-md border border-neutral-700/60 bg-neutral-800/40 lg:col-span-2 flex flex-col sm:flex-row sm:items-end gap-4 ${!activeGroupForThresholds ? 'hidden' : ''}`}> 
                            <div className="space-y-2 flex-grow">
                                <Label htmlFor="thresholdRelativeViewPerformancePercent" className="text-neutral-300">Relative Performance Threshold (%)</Label>
                                <Input
                                    id="thresholdRelativeViewPerformancePercent"
                                    name="thresholdRelativeViewPerformancePercent"
                                    type="number"
                                    placeholder="e.g., 150 (means 150% of avg)"
                                    value={getNullableInputValue(currentThresholds?.thresholdRelativeViewPerformancePercent)}
                                    onChange={(e) => handleGroupThresholdInputChange(editingThresholdsForGroupId, 'thresholdRelativeViewPerformancePercent', e)}
                                    className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    disabled={!activeGroupForThresholds}
                                />
                                <p className="text-xs text-neutral-500">Trigger if views exceed this % of the selected average. Leave blank to disable.</p>
                            </div>
                            <div className="space-y-2 sm:w-[200px]">
                                <Select
                                    value={currentThresholds?.thresholdRelativeViewMetric || ''} 
                                    onValueChange={(value) => handleGroupThresholdSelectChange(editingThresholdsForGroupId, 'thresholdRelativeViewMetric', value)}
                                    disabled={!activeGroupForThresholds}
                                >
                                    <SelectTrigger className="w-full bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow">
                                        <SelectValue placeholder="Select avg..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-800 border-neutral-600 text-white">
                                        <SelectItem value="7d_avg_views" className="hover:bg-neutral-700 focus:bg-neutral-700 cursor-pointer">7-Day Avg Views</SelectItem>
                                        <SelectItem value="14d_avg_views" className="hover:bg-neutral-700 focus:bg-neutral-700 cursor-pointer">14-Day Avg Views</SelectItem>
                                        <SelectItem value="30d_avg_views" className="hover:bg-neutral-700 focus:bg-neutral-700 cursor-pointer">30-Day Avg Views</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-neutral-500 sm:invisible">.</p>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-end gap-3 pt-6">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleResetPreferencesClick}
                            disabled={isResetting}
                            className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-auto"
                        >
                             {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin -ml-1" /> : null}
                             Reset All Preferences
                        </Button>
                        <Button
                            onClick={handleSavePreferencesClick}
                            className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                            disabled={isCurrentlySavingAll || isSaving}
                        >
                            {isCurrentlySavingAll || isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save Groups & Conditions
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default AlertPreferences; 