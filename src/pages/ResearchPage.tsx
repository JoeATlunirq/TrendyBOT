import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BarChart3, Calendar, ChevronDown, ChevronUp, Eye, Filter, FileDown, ListFilter, RefreshCw, Search as SearchIcon, ThumbsUp, MessageSquare, Users, Youtube, ClockIcon, TrendingUp, Award, Zap, Info, AlertCircle, PlayCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import StatCard from "@/components/StatCard";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { useAlertPreferencesStore } from '@/stores/alertPreferencesStore';
import axios from 'axios';
import { toast } from "@/components/ui/use-toast";

// Interface for a channel group (mirrors structure from AlertPreferences for consistency)
interface ChannelGroup {
  id: string; 
  name: string;
  // channelIds: string[]; // REPLACED by resolvedChannels
  resolvedChannels?: Array<{ // Updated to match AlertPreferences
    id: string;
    name?: string;
    pfpUrl?: string;
  }>;
  icon?: string; 
}

// Expected structure for the JSON in NocoDB (from alertPreferencesStore)
interface StoredChannelGroups {
  groups: Array<{
    id: string;
    name: string;
    // channelIds: string[]; // REPLACED by resolvedChannels
    resolvedChannels?: Array<{ // Updated to match AlertPreferences
        id: string;
        name?: string;
        pfpUrl?: string;
    }>;
    icon?: string; 
    // Potentially other fields like notificationsEnabled, thresholds if they become relevant here
  }>;
  selectedResearchGroupId?: string; 
}

// --- NEW: Interfaces for API data ---
interface ApiChannelData {
  id: string;
  name: string;
  thumbnailUrl?: string;
  currentSubscriberCount?: number;
  // lifetimeTotalViewCount?: number; // REVERTED: For lifetime views
  // Fields based on selected timeFrame from backend:
  totalViewsInTimeFrame?: number; // This will go back to being views on NEW videos for specific timeframes, or lifetime for "all_time"
  avgViewsInTimeFrame?: number; 
  videosPublishedInTimeFrame?: number;
  totalLikesInTimeFrame?: number;
  totalCommentsInTimeFrame?: number;
  timeFrameUsed?: string; // e.g., "last_30_days", "all_time"

  uploadsPlaylistId?: string; 
  error?: string; 
  source?: string;

  // Calculated in frontend, now using InTimeFrame fields:
  viewsPerVideoInTimeFrame?: number; // Renamed from viewsPerVideoLast30d
  subToViewRatioInTimeFrame?: number; // Renamed from subToViewRatioLast30d
  avgLikesPerVideoInTimeFrame?: number; // Renamed from avgLikesPerVideoLast30d
  avgCommentsPerVideoInTimeFrame?: number; // Renamed from avgCommentsPerVideoLast30d
  avgEngagementRateInTimeFrame?: number; // Renamed from engagementRateLast30d
}

interface ApiVideoData {
  video_id: string;
  channel_id: string;
  title?: string;
  description?: string;
  published_at?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  latest_view_count?: number;
  latest_like_count?: number;
  latest_comment_count?: number;
  last_stats_update_at?: string;
  engagement_rate?: number; // NEWLY ADDED - will come from backend
  channel_thumbnail_url?: string; // NEW: For channel PFP
  // Calculated fields (to be added later if needed)
  // grade?: string;
  // score?: number;
  // channelName?: string; 
  // channelAvatar?: string;
  // uploadedAgo?: string;
}
// --- END NEW Interfaces ---

// Placeholder data (Structure to be refined based on actual API and NocoDB data)
// const sampleChannels = [ ... ]; // Will be replaced by researchChannelData
// const sampleVideos = [ ... ]; // Will be replaced by researchVideoData

// Helper to format large numbers (e.g., 18.1M)
const formatNumber = (num: number | undefined | null, precision = 1) => {
  if (num === undefined || num === null) return "N/A";
  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(precision) + "M";
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(precision) + "K";
  return num.toString();
};

// Helper to format duration from seconds to MM:SS
const formatDuration = (totalSeconds: number | undefined | null) => {
  if (totalSeconds === undefined || totalSeconds === null) return "N/A";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// --- API Base URL ---
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) return '/api';
  return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';
};
const BACKEND_API_BASE_URL = getApiBaseUrl();
// --- END API Base URL ---

export default function ResearchPage() {
  const { token } = useAuth();
  const alertFilters = useAlertPreferencesStore(state => state.filters);
  const isLoadingPreferences = useAlertPreferencesStore(state => state.isLoading);
  const fetchAlertPreferences = useAlertPreferencesStore(state => state.actions.fetchPreferences);
  const setPersistedFilterField = useAlertPreferencesStore(state => state.actions.setFilterField); // For saving selected group
  
  const [sortBy, setSortBy] = useState("views_high_low");
  const [uploadDateFilter, setUploadDateFilter] = useState("last_30_days"); // Default to 30 days
  const [durationMin, setDurationMin] = useState("");
  const [durationMax, setDurationMax] = useState("");
  const [viewsMin, setViewsMin] = useState("");
  const [viewsMax, setViewsMax] = useState("");
  const [likesMin, setLikesMin] = useState("");
  const [commentsMin, setCommentsMin] = useState("");
  const [engagementRateMinVideo, setEngagementRateMinVideo] = useState("");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  // State for channel groups and selection
  const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // --- NEW: State for Video Pagination ---
  const [videoCurrentPage, setVideoCurrentPage] = useState(1);
  const [videosPerPage, setVideosPerPage] = useState(24); // Number of videos per page
  const [totalVideoItems, setTotalVideoItems] = useState(0);
  // --- END NEW: State for Video Pagination ---

  // --- NEW: State for Detailed Channel Fetch Progress ---
  const [channelFetchProgress, setChannelFetchProgress] = useState({ current: 0, total: 0, currentChannelName: '', isLoading: false });
  // --- END NEW: State for Detailed Channel Fetch Progress ---

  // --- NEW: State for API data ---
  const [researchChannelData, setResearchChannelData] = useState<ApiChannelData[]>([]);
  const [researchVideoData, setResearchVideoData] = useState<ApiVideoData[]>([]);
  const [isLoadingResearchData, setIsLoadingResearchData] = useState(false);
  const [researchDataError, setResearchDataError] = useState<string | null>(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false); // NEW: Track if fetch has been attempted
  // --- END NEW State ---

  // --- NEW: State for Competitor Overview sorting ---
  const [competitorSortBy, setCompetitorSortBy] = useState<keyof ApiChannelData | 'name'>('currentSubscriberCount');
  const [competitorSortOrder, setCompetitorSortOrder] = useState<'asc' | 'desc'>('desc');
  const [competitorTimeFrame, setCompetitorTimeFrame] = useState<string>("last_30_days"); // NEW: State for time frame filter

  // --- NEW: State for Competitor Overview Table Filters ---
  const [competitorViewsMin, setCompetitorViewsMin] = useState("");
  const [competitorViewsMax, setCompetitorViewsMax] = useState("");
  // --- END NEW State for Competitor Overview Table Filters ---

  // Summary Stats (placeholders - will be updated later)
  const [totalVideosInGrid, setTotalVideosInGrid] = useState(0); // For videos in content discovery
  
  // State for accordion sections (can be managed individually if preferred)
  const [openSections, setOpenSections] = useState<string[]>(["competitorChannelOverview", "contentDiscoveryGrid"]); // Updated default open


  // Fetch alert preferences on mount
  useEffect(() => {
    if (token) {
      fetchAlertPreferences(token);
    } else {
      fetchAlertPreferences(null); 
    }
  }, [token, fetchAlertPreferences]);
  
  // Parse stored JSON from alertFilters.filterChannels
  useEffect(() => {
    if (isLoadingPreferences || !alertFilters || !alertFilters.filterChannels) {
      if (!isLoadingPreferences && channelGroups.length > 0) {
          setChannelGroups([]);
          setSelectedGroupId(null); // Also clear selected group
          setResearchChannelData([]); // Clear data if preferences are gone
          setResearchVideoData([]);
      }
      return;
    }

    try {
      const parsedData: StoredChannelGroups = JSON.parse(alertFilters.filterChannels);
      if (parsedData && Array.isArray(parsedData.groups)) {
        setChannelGroups(parsedData.groups);
        
        if (parsedData.selectedResearchGroupId && parsedData.groups.find(g => g.id === parsedData.selectedResearchGroupId)) {
            if (selectedGroupId !== parsedData.selectedResearchGroupId) { // Only set if different to avoid re-triggering fetches
                setSelectedGroupId(parsedData.selectedResearchGroupId);
            }
        } else if (parsedData.groups.length > 0 && !selectedGroupId) {
            // setSelectedGroupId(parsedData.groups[0].id); // Auto-select first group if none selected (can be a user preference)
        } else if (parsedData.groups.length === 0) {
            setSelectedGroupId(null); // No groups, no selection
            setResearchChannelData([]); // Clear data
            setResearchVideoData([]);
        }

      } else {
        setChannelGroups([]);
        setSelectedGroupId(null);
        setResearchChannelData([]);
        setResearchVideoData([]);
      }
    } catch (error) {
      console.error("[ResearchPage] Critical: Failed to parse filterChannels JSON from store. Value:", alertFilters.filterChannels, error);
      setChannelGroups([]);
      setSelectedGroupId(null);
      setResearchChannelData([]);
      setResearchVideoData([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [alertFilters?.filterChannels, isLoadingPreferences]); // Removed selectedGroupId from deps, let selection drive data fetch

  // --- NEW: API Call Functions ---
  const fetchVideoDataForGroup = useCallback(async (
    groupIdForVideos: string, 
    page: number, 
    limit: number,
    currentSortBy: string,
    currentUploadDateFilter: string,
    currentCustomDateStart: string,
    currentCustomDateEnd: string,
    currentDurationMin: string,
    currentDurationMax: string,
    currentViewsMin: string,
    currentViewsMax: string,
    currentLikesMin: string,
    currentCommentsMin: string,
    currentEngagementRateMinVideo: string
  ) => {
    if (!token || !groupIdForVideos) return;
    const group = channelGroups.find(g => g.id === groupIdForVideos);
    if (!group || !group.resolvedChannels || group.resolvedChannels.length === 0) {
        setResearchVideoData([]);
        setTotalVideoItems(0); // Reset total items
        setVideoCurrentPage(1); // Reset page
        return;
    }
    const channelIdsToFetch = group.resolvedChannels.map(rc => rc.id);

    try {
        const response = await axios.get<{list: ApiVideoData[], pagination: {totalItems: number; currentPage: number; totalPages: number;} }>(`${BACKEND_API_BASE_URL}/youtube/videos`, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: { 
                channelIds: channelIdsToFetch.join(','),
                limit: limit,
                page: page,
                sortBy: currentSortBy,
                uploadDateFilter: currentUploadDateFilter,
                customDateStart: currentUploadDateFilter === 'custom_range' ? currentCustomDateStart : undefined,
                customDateEnd: currentUploadDateFilter === 'custom_range' ? currentCustomDateEnd : undefined,
                durationMin: currentDurationMin || undefined,
                durationMax: currentDurationMax || undefined,
                viewsMin: currentViewsMin || undefined,
                viewsMax: currentViewsMax || undefined,
                likesMin: currentLikesMin || undefined,
                commentsMin: currentCommentsMin || undefined,
                engagementRateMinVideo: currentEngagementRateMinVideo || undefined,
            }
        });
        setResearchVideoData(response.data.list || []);
        setTotalVideoItems(response.data.pagination?.totalItems || 0);
        setVideoCurrentPage(response.data.pagination?.currentPage || page);
    } catch (error: any) {
        console.error("[ResearchPage] Failed to fetch video data:", error);
        setResearchDataError("Failed to load video data for the group. " + (error.response?.data?.message || error.message));
        setResearchVideoData([]);
        setTotalVideoItems(0);
        setVideoCurrentPage(1);
        toast({ title: "Video Data Error", description: "Could not load videos for the selected group.", variant: "destructive" });
    } finally {
        // setIsLoadingVideoGrid(false); // Example placeholder
    } 
  }, [token, channelGroups]);


  const fetchChannelResearchApi = useCallback(async (groupIdToFetch: string, forceRefresh = false, timeFrame = "last_30_days") => {
    if (!token || !groupIdToFetch) return;
    const group = channelGroups.find(g => g.id === groupIdToFetch);
    if (!group || !group.resolvedChannels || group.resolvedChannels.length === 0) {
      toast({ title: "No Channels", description: "The selected group has no channels to research.", variant: "default" });
      setResearchChannelData([]);
      setResearchVideoData([]);
      setTotalVideoItems(0); 
      setVideoCurrentPage(1);
      setChannelFetchProgress({ current: 0, total: 0, currentChannelName: '', isLoading: false });
      return;
    }
    const channelIdsToFetch = group.resolvedChannels.map(rc => rc.id);
    setIsLoadingResearchData(true);
    setResearchDataError(null);
    setResearchChannelData([]); 
    setResearchVideoData([]);
    setTotalVideoItems(0); 
    setVideoCurrentPage(1);
    setChannelFetchProgress({ current: 0, total: channelIdsToFetch.length, currentChannelName: '', isLoading: true });
    const fetchedChannelsData: ApiChannelData[] = [];
    let anErrorOccurred = false;
    try {
      for (let i = 0; i < channelIdsToFetch.length; i++) {
        const channelId = channelIdsToFetch[i];
        const currentChannelInfo = group.resolvedChannels?.find(rc => rc.id === channelId);
        const currentChannelName = currentChannelInfo?.name || channelId;
        setChannelFetchProgress(prev => ({ ...prev, current: i + 1, currentChannelName }));
        try {
          const response = await axios.post<ApiChannelData[]>(`${BACKEND_API_BASE_URL}/youtube/channel-data`, 
            { channelIds: [channelId], forceRefresh, timeFrame },
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (response.data && response.data.length > 0) {
            fetchedChannelsData.push(...response.data);
          }
        } catch (channelError: any) {
          console.error(`[ResearchPage] Failed to fetch data for channel ${channelId}:`, channelError);
          throw new Error(`Failed to load data for channel ${currentChannelName || channelId}. ${channelError.response?.data?.message || channelError.message}`);
        }
      }
      setResearchChannelData(fetchedChannelsData);
      toast({ title: "Channel Data Loaded", description: `Fetched data for ${fetchedChannelsData.length} channels.`, variant: "default" });
      setChannelFetchProgress(prev => ({ ...prev, isLoading: false }));
      await fetchVideoDataForGroup(
        groupIdToFetch, 1, videosPerPage, sortBy, uploadDateFilter, customDateStart, customDateEnd, 
        durationMin, durationMax, viewsMin, viewsMax, likesMin, commentsMin, engagementRateMinVideo
      );
    } catch (error: any) {
      console.error("[ResearchPage] Failed to fetch channel research data:", error);
      const errorMsg = error.message || "An unknown error occurred while fetching channel data.";
      setResearchDataError(`Failed to load research data: ${errorMsg}`);
      toast({ title: "Channel Data Error", description: `Could not load data: ${errorMsg}`, variant: "destructive" });
      anErrorOccurred = true;
    } finally {
      setChannelFetchProgress(prev => ({ ...prev, isLoading: false }));
      if (anErrorOccurred || !fetchedChannelsData.length) {
         setIsLoadingResearchData(false); 
      }
      setIsLoadingResearchData(false);
    }
  }, [
    token, channelGroups, fetchVideoDataForGroup, videosPerPage, sortBy, uploadDateFilter, customDateStart, customDateEnd,
    durationMin, durationMax, viewsMin, viewsMax, likesMin, commentsMin, engagementRateMinVideo
  ]);

  // Effect to fetch data when selectedGroupId or competitorTimeFrame changes
  useEffect(() => {
    if (selectedGroupId && hasAttemptedFetch && token) {
      fetchChannelResearchApi(selectedGroupId, false, competitorTimeFrame);
    }
  }, [selectedGroupId, competitorTimeFrame, hasAttemptedFetch, token, fetchChannelResearchApi]);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
    if (alertFilters?.filterChannels) {
        try {
            const currentStoredFilters: StoredChannelGroups = JSON.parse(alertFilters.filterChannels);
            const updatedStoredFilters = { ...currentStoredFilters, selectedResearchGroupId: groupId };
            setPersistedFilterField('filterChannels', JSON.stringify(updatedStoredFilters));
        } catch (e) {
            console.error("[ResearchPage] Failed to parse or save selectedResearchGroupId to store", e);
        }
    }
  };

  const handleFetchDataButtonClick = () => {
    if (!selectedGroupId) {
        toast({ title: "No Group Selected", description: "Please select a channel group first.", variant: "default" });
        return;
    }
    setHasAttemptedFetch(true);
    fetchChannelResearchApi(selectedGroupId, false, competitorTimeFrame);
  };

  const handleRefreshData = () => {
    if (selectedGroupId) {
        setHasAttemptedFetch(true);
        fetchChannelResearchApi(selectedGroupId, true, competitorTimeFrame);
    } else {
        toast({ title: "No Group Selected", description: "Please select a channel group to refresh.", variant: "default"});
    }
  };

  // ... (handleApplyFilters, handleResetFilters remain for now, may need to integrate with new data) ...

  // --- UPDATED: Use researchChannelData instead of sampleChannels ---
  // const getRankedChannels = (metric: keyof ApiChannelData, count = 5) => { ... } // This will need adjustment
  const selectedGroupName = selectedGroupId ? channelGroups.find(g => g.id === selectedGroupId)?.name : null;
  const isLoadingGroupSelector = isLoadingPreferences && channelGroups.length === 0;

  // --- Derived state for sorted competitor channels ---
  const sortedCompetitorChannelData = React.useMemo(() => {
    const dataWithCalculatedStats = researchChannelData.map(channel => {
      const views = channel.totalViewsInTimeFrame || 0;
      const likes = channel.totalLikesInTimeFrame || 0;
      const comments = channel.totalCommentsInTimeFrame || 0;
      const videosPublished = channel.videosPublishedInTimeFrame || 0;

      let engagementRate: number | null = 0; // Initialize as number or null
      if (channel.timeFrameUsed === 'all_time') {
        engagementRate = null; // Set to null for 'all_time'
      } else if (views > 0 && (likes > 0 || comments > 0)) {
        engagementRate = ((likes + comments) / views) * 100;
      }

      return {
        ...channel,
        viewsPerVideoInTimeFrame: videosPublished > 0 && views > 0
                              ? views / videosPublished 
                              : 0,
        // subToViewRatio is tricky with dynamic timeframes for views vs lifetime subs. 
        // Let's keep it based on current subs and views in timeframe for now.
        subToViewRatioInTimeFrame: (channel.currentSubscriberCount && channel.currentSubscriberCount > 0 && views > 0)
                              ? views / channel.currentSubscriberCount 
                              : 0,
        avgLikesPerVideoInTimeFrame: videosPublished > 0 && likes > 0
                              ? likes / videosPublished
                              : 0,
        avgCommentsPerVideoInTimeFrame: videosPublished > 0 && comments > 0
                              ? comments / videosPublished
                              : 0,
        avgEngagementRateInTimeFrame: engagementRate,
      };
    });

    // Apply table-specific filters
    let filteredData = [...dataWithCalculatedStats];
    const minViews = parseInt(competitorViewsMin, 10);
    const maxViews = parseInt(competitorViewsMax, 10);

    if (!isNaN(minViews) && minViews > 0) {
      filteredData = filteredData.filter(c => c.totalViewsInTimeFrame !== undefined && c.totalViewsInTimeFrame >= minViews);
    }
    if (!isNaN(maxViews) && maxViews > 0) {
      filteredData = filteredData.filter(c => c.totalViewsInTimeFrame !== undefined && c.totalViewsInTimeFrame <= maxViews);
    }
    // End Apply table-specific filters

    const sorted = filteredData.sort((a, b) => { // Sort the filteredData
      let valA = a[competitorSortBy as keyof typeof a];
      let valB = b[competitorSortBy as keyof typeof b];

      // Handle name sorting (string)
      if (competitorSortBy === 'name') {
        valA = a.name || '';
        valB = b.name || '';
        return competitorSortOrder === 'asc' ? (valA as string).localeCompare(valB as string) : (valB as string).localeCompare(valA as string);
      }
      
      // Handle undefined or null for numeric sorts, pushing them to the bottom for desc, top for asc
      if (valA == null && valB == null) return 0;
      if (valA == null) return competitorSortOrder === 'desc' ? 1 : -1;
      if (valB == null) return competitorSortOrder === 'desc' ? -1 : 1;

      // Numeric sorting
      return competitorSortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return sorted;
  }, [researchChannelData, competitorSortBy, competitorSortOrder, competitorViewsMin, competitorViewsMax]); // Added filter states to dependencies

  const handleCompetitorSort = (column: 'name' | 'currentSubscriberCount' | 'totalViewsInTimeFrame' | 'avgViewsInTimeFrame' | 'avgEngagementRateInTimeFrame') => { 
    if (competitorSortBy === column) {
      setCompetitorSortOrder(competitorSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setCompetitorSortBy(column);
      setCompetitorSortOrder('desc'); // Default to desc for new column
    }
  };
  // --- END Derived state for sorting competitors ---

  // --- NEW: Derived state for filtered and sorted videos ---
  const displayedVideoData = researchVideoData;

  useEffect(() => {
    setTotalVideosInGrid(displayedVideoData.length); // This now reflects the current page's video count
                                                 // totalVideoItems from API reflects total after filtering
  }, [displayedVideoData]);

  const handleVideoPageChange = useCallback(async (newPage: number) => {
    if (selectedGroupId && newPage > 0) { 
      await fetchVideoDataForGroup(
        selectedGroupId, newPage, videosPerPage, sortBy, uploadDateFilter, customDateStart, customDateEnd,
        durationMin, durationMax, viewsMin, viewsMax, likesMin, commentsMin, engagementRateMinVideo
      );
    }
  }, [
    selectedGroupId, fetchVideoDataForGroup, videosPerPage, sortBy, uploadDateFilter, customDateStart, customDateEnd,
    durationMin, durationMax, viewsMin, viewsMax, likesMin, commentsMin, engagementRateMinVideo
  ]);

  // --- NEW: useEffect to refetch videos when filters change ---
  useEffect(() => {
    if (selectedGroupId && hasAttemptedFetch) { // Only refetch if a group is selected and initial fetch was done
      // Call fetchVideoDataForGroup directly, resetting to page 1
      fetchVideoDataForGroup(
        selectedGroupId, 
        1, // Reset to page 1 when filters change
        videosPerPage, 
        sortBy, 
        uploadDateFilter, 
        customDateStart, 
        customDateEnd, 
        durationMin, 
        durationMax, 
        viewsMin, 
        viewsMax, 
        likesMin, 
        commentsMin, 
        engagementRateMinVideo
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Do NOT include fetchVideoDataForGroup here to avoid loop with its own definition changes
    // Do NOT include selectedGroupId, videosPerPage here as they are handled by other effects or direct calls
    // This effect is ONLY for filter changes triggering a refetch.
    sortBy, 
    uploadDateFilter, 
    customDateStart, 
    customDateEnd, 
    durationMin, 
    durationMax, 
    viewsMin, 
    viewsMax, 
    likesMin, 
    commentsMin, 
    engagementRateMinVideo,
    // selectedGroupId and hasAttemptedFetch are in the if condition, 
    // but adding them to deps here makes sense if we want re-fetch on their change *if conditions are met*.
    // For now, let's keep it focused on pure filter changes.
    // If selectedGroupId changes, the main data fetch should handle it.
  ]);

  return (
    <div className="space-y-6 text-neutral-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-orbitron flex items-center">
            <SearchIcon className="h-8 w-8 mr-3 text-trendy-yellow" /> Niche Research Dashboard
          </h1>
          <p className="text-neutral-400">
            Analyze competitor channels and discover content opportunities for {selectedGroupName ? `the "${selectedGroupName}" group` : "your selected niche"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
            {/* NEW Fetch Data Button */}
            <Button 
                variant="default" 
                size="sm" 
                className="bg-trendy-yellow hover:bg-trendy-yellow/90 text-neutral-800"
                onClick={handleFetchDataButtonClick}
                disabled={isLoadingResearchData || !selectedGroupId}
            >
                <PlayCircle className={`h-4 w-4 mr-2 ${isLoadingResearchData && hasAttemptedFetch ? 'animate-spin' : ''}`} />
                {isLoadingResearchData && hasAttemptedFetch ? 'Loading...' : 'Load Research Data'}
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white"
                onClick={handleRefreshData}
                disabled={isLoadingResearchData || !selectedGroupId}
            >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingResearchData ? 'animate-spin' : ''}`} />
                {isLoadingResearchData ? 'Refreshing...' : 'Refresh Data'}
            </Button>
            {/* Export Data Dropdown can remain as is for now */}
        </div>
      </div>

      {/* Group Selector & Loading/Error States */}
      <Card className="bg-neutral-800/60 border-neutral-700">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-1">
              <Label htmlFor="channelGroupSelect" className="text-sm font-medium text-neutral-300 mb-1 block">
                Select Niche Group
              </Label>
              <Select
                value={selectedGroupId || ""}
                onValueChange={handleGroupSelect}
                disabled={isLoadingGroupSelector || channelGroups.length === 0}
              >
                <SelectTrigger id="channelGroupSelect" className="w-full bg-neutral-700 border-neutral-600 text-neutral-200 focus:ring-trendy-yellow">
                  <SelectValue placeholder={isLoadingGroupSelector ? "Loading groups..." : "Select a Niche Group"} />
                </SelectTrigger>
                <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-200">
                  {isLoadingGroupSelector ? (
                    <SelectItem value="loading" disabled className="text-neutral-400">Loading groups...</SelectItem>
                  ) : channelGroups.length > 0 ? (
                    channelGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id} className="hover:bg-neutral-600">
                        {group.icon && <span className="mr-2">{group.icon}</span>}{group.name} ({(group.resolvedChannels || []).length} channels)
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-groups" disabled className="text-neutral-400">
                      No channel groups found. Add them in Alert Preferences.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {/* Placeholder for future global filters or actions */}
            <div className="md:col-span-2 flex justify-end items-center">
                {/* Could add high-level summary or actions here */}
            </div>
          </div>

          {!selectedGroupId && !isLoadingResearchData && !isLoadingGroupSelector && channelGroups.length > 0 && (
             <div className="mt-4 p-4 bg-neutral-700/50 border border-neutral-600 rounded-md text-center text-neutral-300">
                <Info className="h-5 w-5 inline-block mr-2 mb-1" />
                Please select a Niche Group above and click "Load Research Data".
            </div>
          )}

          {isLoadingResearchData && hasAttemptedFetch && ( // Only show loader if fetch was attempted
            <div className="mt-6 flex justify-center items-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-trendy-yellow mr-3" />
              {channelFetchProgress.isLoading && channelFetchProgress.total > 0 ? (
                <span className="text-neutral-300">
                  Loading channel {channelFetchProgress.current} of {channelFetchProgress.total}: {channelFetchProgress.currentChannelName || 'Fetching details'}...
                </span>
              ) : (
                <span className="text-neutral-300">Loading research data...</span> // General message or for video loading phase
              )}
            </div>
          )}
          {researchDataError && !isLoadingResearchData && hasAttemptedFetch && ( // Only show error if fetch was attempted
            <div className="mt-6 p-4 bg-red-900/30 border border-red-700 rounded-md text-center text-red-300">
                <AlertCircle className="h-5 w-5 inline-block mr-2 mb-1" />
                Error: {researchDataError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accordion Sections - Conditionally render if data is available AND fetch attempted */}
      {selectedGroupId && !isLoadingResearchData && !researchDataError && researchChannelData.length > 0 && hasAttemptedFetch && (
        <Accordion type="multiple" defaultValue={openSections} onValueChange={setOpenSections} className="space-y-4">
          {/* Competitor Channel Overview */}
          <AccordionItem value="competitorChannelOverview" className="bg-neutral-800/60 border-neutral-700 rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline text-lg font-medium text-neutral-100 data-[state=open]:border-b data-[state=open]:border-neutral-700">
                <div className="flex items-center">
                    <Award className="h-5 w-5 mr-3 text-trendy-gold" /> Competitor Channel Overview
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-6 space-y-4">
              {/* Time Frame Selector and Filters for Competitor Overview Table */}
              {/* ... Competitor overview table and filters ... (original content) */}
              <div className="mb-4 p-3 bg-neutral-700/40 border border-neutral-600 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label htmlFor="competitorTimeFrame" className="text-xs text-neutral-400">Time Frame</Label>
                    <Select value={competitorTimeFrame} onValueChange={setCompetitorTimeFrame}>
                      <SelectTrigger id="competitorTimeFrame" className="bg-neutral-600 border-neutral-500 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-200">
                        <SelectItem value="last_24_hours">Last 24 Hours</SelectItem>
                        <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                        <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                        <SelectItem value="all_time">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="competitorViewsMin" className="text-xs text-neutral-400">Min Views ({competitorTimeFrame.replace('_', ' ')})</Label>
                    <Input id="competitorViewsMin" type="number" placeholder="e.g., 100000" value={competitorViewsMin} onChange={(e) => setCompetitorViewsMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70 text-sm" />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="competitorViewsMax" className="text-xs text-neutral-400">Max Views ({competitorTimeFrame.replace('_', ' ')})</Label>
                    <Input id="competitorViewsMax" type="number" placeholder="e.g., 5000000" value={competitorViewsMax} onChange={(e) => setCompetitorViewsMax(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70 text-sm" />
                  </div>
                </div>
              </div>
              {sortedCompetitorChannelData.length === 0 && !isLoadingResearchData && <p className="text-neutral-400">No channel data matches your filters or is available for this group.</p>}
              {isLoadingResearchData && <p className="text-neutral-400">Loading channel overview...</p>} 
              {researchChannelData.length === 0 && hasAttemptedFetch && !isLoadingResearchData && (
                <p className="text-neutral-400">No channel data matches your filters or is available for this group. Try adjusting filters or the time frame.</p>
              )}
              {sortedCompetitorChannelData.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm text-left text-neutral-300">
                    <thead className="text-xs text-neutral-400 uppercase bg-neutral-700/50">
                      <tr>
                        <th scope="col" className="px-4 py-3 w-[5%]">#</th>
                        <th scope="col" className="px-4 py-3 w-[35%] cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('name')}>
                          Channel {competitorSortBy === 'name' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        <th scope="col" className="px-4 py-3 w-[15%] text-right cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('currentSubscriberCount')}>
                          Subs {competitorSortBy === 'currentSubscriberCount' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        {/* REVERTED: Lifetime Total Views Column REMOVED */}
                        <th scope="col" className="px-4 py-3 w-[20%] text-right cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('totalViewsInTimeFrame')}>
                          Views ({competitorTimeFrame.replace('_',' ')}) {competitorSortBy === 'totalViewsInTimeFrame' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        <th scope="col" className="px-4 py-3 w-[20%] text-right cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('avgViewsInTimeFrame')}>
                          Avg Views/Vid ({competitorTimeFrame.replace('_',' ')}) {competitorSortBy === 'avgViewsInTimeFrame' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        <th scope="col" className="px-4 py-3 w-[20%] text-right cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('avgEngagementRateInTimeFrame')}>
                           Avg. Eng. Rate ({competitorTimeFrame.replace('_',' ')}) {competitorSortBy === 'avgEngagementRateInTimeFrame' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCompetitorChannelData.map((channel, index) => (
                        <tr key={channel.id} className="border-b border-neutral-700 hover:bg-neutral-700/40">
                          <td className="px-4 py-2 text-neutral-400">{index + 1}</td>
                          <td scope="row" className="px-4 py-2 font-medium text-white whitespace-nowrap">
                            <a 
                                href={`https://www.youtube.com/channel/${channel.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 hover:text-trendy-gold transition-colors group"
                            >
                                {channel.thumbnailUrl && <img src={channel.thumbnailUrl} alt={channel.name} className="w-10 h-10 rounded-full border border-neutral-600 group-hover:border-trendy-gold transition-colors"/>}
                                <span className="truncate max-w-[100px] group-hover:underline" title={channel.name}>{channel.name || 'Unnamed Channel'}</span> 
                            </a>
                            {channel.error && <p className="text-xs text-red-400 mt-1">Error: {channel.error}</p>}
                          </td>
                          <td className="px-4 py-2 text-right">{formatNumber(channel.currentSubscriberCount)}</td>
                          {/* REVERTED: Display Lifetime Total Views REMOVED */}
                          <td className="px-4 py-2 text-right">{formatNumber(channel.totalViewsInTimeFrame)}</td>
                          <td className="px-4 py-2 text-right">{formatNumber(channel.avgViewsInTimeFrame)}</td>
                          <td className="px-4 py-2 text-right">{channel.avgEngagementRateInTimeFrame?.toFixed(1) ?? 'N/A'}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Content Discovery Grid */}
          <AccordionItem value="contentDiscoveryGrid" className="bg-neutral-800/60 border-neutral-700 rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline text-lg font-medium text-neutral-100 data-[state=open]:border-b data-[state=open]:border-neutral-700">
                <div className="flex items-center">
                    <Zap className="h-5 w-5 mr-3 text-trendy-teal" /> Content Discovery Grid
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-6">
              {/* Filters for the video grid (sortBy, uploadDateFilter, etc.) */}
              {/* ... Video grid filters ... (original content) */}
              <div className="mb-6 p-4 bg-neutral-700/50 border border-neutral-600 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  {/* Sort By */}
                  <div>
                    <Label htmlFor="sortBy" className="text-xs text-neutral-400">Sort By</Label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger id="sortBy" className="bg-neutral-600 border-neutral-500"> <SelectValue /> </SelectTrigger>
                      <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-200">
                        <SelectItem value="views_high_low">Views: High to Low</SelectItem>
                        <SelectItem value="views_low_high">Views: Low to High</SelectItem>
                        <SelectItem value="date_new_old">Date: Newest First</SelectItem>
                        <SelectItem value="date_old_new">Date: Oldest First</SelectItem>
                        <SelectItem value="likes_high_low">Likes: High to Low</SelectItem>
                        <SelectItem value="comments_high_low">Comments: High to Low</SelectItem>
                        <SelectItem value="engagement_rate_high_low">Engagement Rate: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Upload Date */}
                  <div>
                    <Label htmlFor="uploadDate" className="text-xs text-neutral-400">Upload Date</Label>
                    <Select value={uploadDateFilter} onValueChange={setUploadDateFilter}>
                      <SelectTrigger id="uploadDate" className="bg-neutral-600 border-neutral-500"> <SelectValue /> </SelectTrigger>
                      <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-200">
                        <SelectItem value="any">Any Time</SelectItem>
                        <SelectItem value="last_24_hours">Last 24 Hours</SelectItem>
                        <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                        <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                        <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                        <SelectItem value="custom_range">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conditional Custom Date Inputs */}
                  {uploadDateFilter === "custom_range" && (
                    <>
                      <div>
                        <Label htmlFor="customDateStart" className="text-xs text-neutral-400">Start Date</Label>
                        <Input 
                          id="customDateStart" 
                          type="date" 
                          value={customDateStart} 
                          onChange={(e) => setCustomDateStart(e.target.value)} 
                          className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" 
                        />
                      </div>
                      <div>
                        <Label htmlFor="customDateEnd" className="text-xs text-neutral-400">End Date</Label>
                        <Input 
                          id="customDateEnd" 
                          type="date" 
                          value={customDateEnd} 
                          onChange={(e) => setCustomDateEnd(e.target.value)} 
                          className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" 
                        />
                      </div>
                    </>
                  )}

                  {/* Duration */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="durationMin" className="text-xs text-neutral-400">Duration Min (s)</Label>
                      <Input id="durationMin" type="number" placeholder="e.g., 60" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                    </div>
                    <div>
                      <Label htmlFor="durationMax" className="text-xs text-neutral-400">Duration Max (s)</Label>
                      <Input id="durationMax" type="number" placeholder="e.g., 300" value={durationMax} onChange={(e) => setDurationMax(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                    </div>
                  </div>
                  
                  {/* Views */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="viewsMin" className="text-xs text-neutral-400">Views Min</Label>
                      <Input id="viewsMin" type="number" placeholder="e.g., 10000" value={viewsMin} onChange={(e) => setViewsMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                    </div>
                    <div>
                      <Label htmlFor="viewsMax" className="text-xs text-neutral-400">Views Max</Label>
                      <Input id="viewsMax" type="number" placeholder="e.g., 1000000" value={viewsMax} onChange={(e) => setViewsMax(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                    </div>
                  </div>

                  {/* NEW: Likes Min Filter */}
                  <div>
                    <Label htmlFor="likesMin" className="text-xs text-neutral-400">Min Likes</Label>
                    <Input id="likesMin" type="number" placeholder="e.g., 1000" value={likesMin} onChange={(e) => setLikesMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                  </div>

                  {/* NEW: Comments Min Filter */}
                  <div>
                    <Label htmlFor="commentsMin" className="text-xs text-neutral-400">Min Comments</Label>
                    <Input id="commentsMin" type="number" placeholder="e.g., 100" value={commentsMin} onChange={(e) => setCommentsMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                  </div>
                  
                  {/* NEW: Video Engagement Rate Min Filter */}
                  <div>
                    <Label htmlFor="engagementRateMinVideo" className="text-xs text-neutral-400">Min Video ER (%)</Label>
                    <Input id="engagementRateMinVideo" type="number" placeholder="e.g., 2.5" value={engagementRateMinVideo} onChange={(e) => setEngagementRateMinVideo(e.target.value)} step="0.1" className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                  </div>

                </div>
              </div>
              
              {/* Video Grid Area - Restored with minimal card content */}
              {displayedVideoData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayedVideoData.map((video) => {
                    // Calculate Engagement Rate
                    const likes = video.latest_like_count || 0;
                    const comments = video.latest_comment_count || 0;
                    const views = video.latest_view_count;
                    let calculatedEngagementRate: number | null = null;
                    if (views && views > 0 && (likes > 0 || comments > 0)) {
                      calculatedEngagementRate = ((likes + comments) / views) * 100;
                    }

                    return (
                      <a 
                        key={video.video_id} 
                        href={`https://www.youtube.com/watch?v=${video.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:scale-[1.02] transition-transform duration-150 ease-in-out group"
                      >
                        <Card className="bg-neutral-700/70 border-neutral-600 group-hover:border-neutral-500 overflow-hidden h-full flex flex-col">
                          <div className="relative">
                            <img 
                              src={video.thumbnail_url || 'https://placehold.co/400x225/262626/e5e5e5?text=No+Thumb'} 
                              alt={video.title || 'Video'} 
                              className="w-full h-auto object-cover aspect-video"
                            />
                            {video.duration_seconds > 0 && (
                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded z-10">
                                    {formatDuration(video.duration_seconds)}
                                </div>
                            )}
                            {/* NEW: Channel PFP */} 
                            {video.channel_thumbnail_url && (
                                <img 
                                    src={video.channel_thumbnail_url}
                                    alt="Channel PFP"
                                    className="absolute bottom-1 left-1 w-8 h-8 rounded-full border-2 border-neutral-800 z-10"
                                />
                            )}
                          </div>
                          <CardContent className="p-3 space-y-2 flex-grow flex flex-col justify-between">
                            {/* Top part of card content (title, etc.) */}
                            <div>
                                <h3 
                                    className="text-sm font-semibold text-white group-hover:text-neutral-100 transition-colors line-clamp-2" 
                                    title={video.title}
                                    style={{ minHeight: '2.5em' }} // Ensures space for two lines to reduce layout shift
                                >
                                    {video.title || 'Untitled Video'}
                                </h3>
                            </div>
                            
                            {/* Bottom part of card content (stats, date) */}
                            <div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-300 mb-2">
                                  <div className="flex items-center space-x-1">
                                    <Eye size={14} className="text-neutral-400" />
                                    <span>{formatNumber(video.latest_view_count, 0)} views</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <ThumbsUp size={14} className="text-neutral-400" />
                                    <span>{formatNumber(video.latest_like_count, 0)} likes</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <MessageSquare size={14} className="text-neutral-400" />
                                    <span>{formatNumber(video.latest_comment_count, 0)}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <TrendingUp size={14} className="text-neutral-400" />
                                    <span>
                                      {typeof calculatedEngagementRate === 'number' 
                                        ? calculatedEngagementRate.toFixed(1) + '%'
                                        : 'N/A'}
                                    </span>
                                  </div>
                                </div>

                                {video.published_at && (
                                  <div className="flex items-center space-x-1 text-xs text-neutral-400 pt-1">
                                      <Calendar size={14} className="text-neutral-500" />
                                      <span>
                                          {new Date(video.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                      </span>
                                  </div>
                                )}
                            </div>
                          </CardContent>
                        </Card>
                      </a>
                    );
                  })}
                </div>
              ) : (
                 <p className="text-center text-neutral-400 py-8">
                    {isLoadingResearchData && hasAttemptedFetch ? 'Loading videos...' : 
                     !hasAttemptedFetch && selectedGroupId ? 'Click "Load Research Data" to see content.' : 
                     !selectedGroupId ? 'Select a group to begin.':
                     (researchChannelData.length > 0 ? 'No videos found for the current channels/filters.' : 'Select a group and load data to see videos.')}
                </p>
              )}

              {/* Video Pagination Controls */}
              {displayedVideoData.length > 0 && totalVideoItems > videosPerPage && (
                <div className="mt-6 flex justify-center items-center space-x-4">
                  <Button
                    onClick={() => handleVideoPageChange(videoCurrentPage - 1)}
                    disabled={videoCurrentPage <= 1 || isLoadingResearchData}
                    variant="outline"
                    className="bg-neutral-600 hover:bg-neutral-500 border-neutral-500 disabled:opacity-50"
                  >
                    Previous
                  </Button>
                  <span className="text-neutral-300">
                    Page {videoCurrentPage} of {Math.ceil(totalVideoItems / videosPerPage)}
                  </span>
                  <Button
                    onClick={() => handleVideoPageChange(videoCurrentPage + 1)}
                    disabled={(videoCurrentPage * videosPerPage) >= totalVideoItems || isLoadingResearchData}
                    variant="outline"
                    className="bg-neutral-600 hover:bg-neutral-500 border-neutral-500 disabled:opacity-50"
                  >
                    Next
                  </Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
} 