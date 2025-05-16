import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { BarChart3, Calendar, ChevronDown, ChevronUp, Eye, Filter, FileDown, ListFilter, RefreshCw, Search as SearchIcon, ThumbsUp, MessageSquare, Users, Youtube, ClockIcon, TrendingUp, Award, Zap, Info, AlertCircle, PlayCircle, Maximize2, ExternalLink, LineChart as LineChartIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import StatCard from "@/components/StatCard";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { useAlertPreferencesStore } from '@/stores/alertPreferencesStore';
import axios from 'axios';
import { toast } from "@/components/ui/use-toast";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Interface for a channel group (mirrors structure from AlertPreferences for consistency)
interface ChannelGroup {
  id: string; 
  name: string;
  resolvedChannels?: Array<{
    id: string;
    name?: string;
    pfpUrl?: string;
    handle?: string;
  }>;
  icon?: string; 
}

// Expected structure for the JSON in NocoDB (from alertPreferencesStore)
interface StoredChannelGroups {
  groups: Array<{
    id: string;
    name: string;
    resolvedChannels?: Array<{
        id: string;
        name?: string;
        pfpUrl?: string;
        handle?: string;
    }>;
    icon?: string; 
  }>;
  selectedResearchGroupId?: string; 
}

// --- UPDATED: Interface for API Channel Data ---
interface ApiChannelData {
  id: string; // YouTube Channel ID
  name: string;
  channelHandle?: string; // YouTube Channel Handle (e.g., @MrBeast)
  thumbnailUrl?: string;
  currentSubscriberCount?: number; // Latest total subscriber count
  currentTotalViews?: number; // Latest lifetime total views (from ViewStats if available)

  // Period-specific data (primarily from ViewStats)
  viewsGainedInPeriod?: number;
  subsGainedInPeriod?: number;
  videosPublishedInPeriod?: number; // This field may be present for the EXPANDED modal if ViewStats 'max' data has it
  
  // avgViewsPerVideoInPeriod?: number; // REMOVED from general table data expectation

  // Data source and error info
  source?: string; // Generic source string from backend now (e.g., 'viewstats_success_generic', 'alternative_source_fallback')
  error?: string; // General error message
  errorType?: string | null; // Generic error type string from backend now (e.g., 'primary_source_not_found', 'alternative_source_api_error')

  // For charts in expanded view (daily data points)
  dailyChartData?: Array<{
    date: string; // YYYY-MM-DD
    viewCountDelta?: number;
    subscriberCountDelta?: number;
    // if ViewStats provides total views/subs per day, they can be added here
    totalViews?: number; 
    totalSubscribers?: number;
  }>;

  uploadsPlaylistId?: string; // Still potentially useful for fallback or other features
  timeFrameUsed?: string; // The timeframe this data pertains to e.g. "7d", "28d"
}
// --- END UPDATED Interface ---


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
  engagement_rate?: number;
  channel_thumbnail_url?: string;
}

// Helper to format large numbers (e.g., 18.1M)
const formatNumber = (num: number | undefined | null, precision = 1, includeSign = false) => {
  if (num === undefined || num === null) return "N/A";
  const sign = num > 0 && includeSign ? "+" : "";

  // Show full number if less than 10,000 (or -10,000)
  if (Math.abs(num) < 10000) {
    return sign + num.toLocaleString(undefined, { maximumFractionDigits: precision > 0 && Math.abs(num) < 1000 ? precision : 0 });
  }
  
  if (Math.abs(num) >= 1000000) {
    return sign + (num / 1000000).toFixed(precision + 1) + "M"; // Increased precision for M
  }
  if (Math.abs(num) >= 1000) {
    return sign + (num / 1000).toFixed(precision) + "K";
  }
  return sign + num.toString(); // Fallback
};

// Helper to format duration from seconds to MM:SS
const formatDuration = (totalSeconds: number | undefined | null) => {
  if (totalSeconds === undefined || totalSeconds === null) return "N/A";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const getApiBaseUrl = () => {
  if (import.meta.env.PROD) return '/api';
  return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';
};
const BACKEND_API_BASE_URL = getApiBaseUrl();

// --- NEW: Type for competitor timeframes ---
type CompetitorTimeFrame = '1d' | '7d' | '28d' | '90d' | '365d' | 'max';

export default function ResearchPage() {
  const { token } = useAuth();
  const alertFilters = useAlertPreferencesStore(state => state.filters);
  const isLoadingPreferences = useAlertPreferencesStore(state => state.isLoading);
  const fetchAlertPreferences = useAlertPreferencesStore(state => state.actions.fetchPreferences);
  const setPersistedFilterField = useAlertPreferencesStore(state => state.actions.setFilterField);
  
  const [sortBy, setSortBy] = useState("views_high_low");
  const [uploadDateFilter, setUploadDateFilter] = useState("last_30_days");
  const [durationMin, setDurationMin] = useState("");
  const [durationMax, setDurationMax] = useState("");
  const [viewsMin, setViewsMin] = useState("");
  const [viewsMax, setViewsMax] = useState("");
  const [likesMin, setLikesMin] = useState("");
  const [commentsMin, setCommentsMin] = useState("");
  const [engagementRateMinVideo, setEngagementRateMinVideo] = useState("");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [videoCurrentPage, setVideoCurrentPage] = useState(1);
  const [videosPerPage, setVideosPerPage] = useState(24);
  const [totalVideoItems, setTotalVideoItems] = useState(0);

  const [channelFetchProgress, setChannelFetchProgress] = useState({ current: 0, total: 0, currentChannelName: '', isLoading: false });

  const [researchChannelData, setResearchChannelData] = useState<ApiChannelData[]>([]);
  const [researchVideoData, setResearchVideoData] = useState<ApiVideoData[]>([]);
  const [isLoadingResearchData, setIsLoadingResearchData] = useState(false);
  const [researchDataError, setResearchDataError] = useState<string | null>(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  // --- UPDATED: State for Competitor Overview ---
  const [competitorSortBy, setCompetitorSortBy] = useState<keyof Pick<ApiChannelData, 'name' | 'currentSubscriberCount' | 'viewsGainedInPeriod' | 'subsGainedInPeriod'>>('currentSubscriberCount');
  const [competitorSortOrder, setCompetitorSortOrder] = useState<'asc' | 'desc'>('desc');
  const [competitorTimeFrame, setCompetitorTimeFrame] = useState<CompetitorTimeFrame>("28d"); // Default to 28 days

  const [competitorViewsMin, setCompetitorViewsMin] = useState(""); // For filtering table by views gained
  const [competitorViewsMax, setCompetitorViewsMax] = useState("");

  // --- NEW: State for Expanded Channel Modal ---
  const [expandedChannel, setExpandedChannel] = useState<ApiChannelData | null>(null);
  const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);
  const [expandedModalTimeFrame, setExpandedModalTimeFrame] = useState<CompetitorTimeFrame>("28d");
  const [isLoadingExpandedChannelDetails, setIsLoadingExpandedChannelDetails] = useState(false);


  const [totalVideosInGrid, setTotalVideosInGrid] = useState(0);
  const [openSections, setOpenSections] = useState<string[]>(["competitorChannelOverview", "contentDiscoveryGrid"]);


  useEffect(() => {
    if (token) {
      fetchAlertPreferences(token);
    } else {
      fetchAlertPreferences(null); 
    }
  }, [token, fetchAlertPreferences]);
  
  useEffect(() => {
    if (isLoadingPreferences || !alertFilters || !alertFilters.filterChannels) {
      if (!isLoadingPreferences && channelGroups.length > 0) {
          setChannelGroups([]);
          setSelectedGroupId(null); 
          setResearchChannelData([]); 
          setResearchVideoData([]);
      }
      return;
    }

    try {
      const parsedData: StoredChannelGroups = JSON.parse(alertFilters.filterChannels);
      if (parsedData && Array.isArray(parsedData.groups)) {
        setChannelGroups(parsedData.groups);
        
        if (parsedData.selectedResearchGroupId && parsedData.groups.find(g => g.id === parsedData.selectedResearchGroupId)) {
            if (selectedGroupId !== parsedData.selectedResearchGroupId) {
                setSelectedGroupId(parsedData.selectedResearchGroupId);
            }
        } else if (parsedData.groups.length > 0 && !selectedGroupId) {
            // setSelectedGroupId(parsedData.groups[0].id); // Auto-select first group
        } else if (parsedData.groups.length === 0) {
            setSelectedGroupId(null); 
            setResearchChannelData([]);
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
  }, [alertFilters?.filterChannels, isLoadingPreferences]); 

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
        setTotalVideoItems(0);
        setVideoCurrentPage(1);
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
    }
  }, [token, channelGroups]);

  // --- UPDATED: fetchChannelResearchApi to use new competitorTimeFrame ---
  const fetchChannelResearchApi = useCallback(async (groupIdToFetch: string, forceRefresh = false, timeFrame: CompetitorTimeFrame) => {
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
    
    // Ensure channelIds and channelHandles are always arrays of the same length,
    // prioritizing actual handles but falling back to IDs for the channelHandles array if a handle is missing.
    const channelIds: string[] = [];
    const channelHandlesForApi: string[] = [];

    group.resolvedChannels.forEach(rc => {
        if (rc.id) { // Only process if there's an ID
            channelIds.push(rc.id);
            // For channelHandlesForApi, use the handle if present, otherwise use the ID.
            // The backend will attempt to use these with ViewStats (prefixing @ if needed).
            // If an ID is used and ViewStats 404s, backend fallback to YT API should occur.
            channelHandlesForApi.push(rc.handle || rc.id); 
        }
    });

    if (channelIds.length === 0) {
        toast({ title: "No valid channels to fetch", description: "The selected group contains no channels with IDs.", variant: "default" });
        return;
    }

    setIsLoadingResearchData(true);
    setResearchDataError(null);
    setResearchChannelData([]); 
    setResearchVideoData([]);
    setTotalVideoItems(0); 
    setVideoCurrentPage(1);
    setChannelFetchProgress({ current: 0, total: channelIds.length, currentChannelName: 'Fetching channel data...', isLoading: true });
    
    const fetchedChannelsData: ApiChannelData[] = [];
    let anErrorOccurred = false;

    try {
      const response = await axios.post<ApiChannelData[]>(`${BACKEND_API_BASE_URL}/youtube/channel-data`, 
          { 
            channelIds: channelIds, 
            channelHandles: channelHandlesForApi, // Send the potentially mixed array
            forceRefresh, 
            timeFrame 
          },
          { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data && Array.isArray(response.data)) {
        fetchedChannelsData.push(...response.data);
        setResearchChannelData(fetchedChannelsData);
        toast({ title: "Channel Data Loaded", description: `Fetched data for ${fetchedChannelsData.length} channels.`, variant: "default" });
      } else {
        throw new Error("Invalid data format received from server for channel data.");
      }
      
      setChannelFetchProgress(prev => ({ ...prev, isLoading: false, current: channelIds.length, currentChannelName: 'Finished loading channel data.' }));

      await fetchVideoDataForGroup(
        groupIdToFetch, 1, videosPerPage, sortBy, uploadDateFilter, customDateStart, customDateEnd, 
        durationMin, durationMax, viewsMin, viewsMax, likesMin, commentsMin, engagementRateMinVideo
      );

    } catch (error: any) {
      console.error("[ResearchPage] Failed to fetch channel research data:", error);
      const errorMsg = error.response?.data?.message || error.message || "An unknown error occurred while fetching channel data.";
      setResearchDataError(`Failed to load research data: ${errorMsg}`);
      toast({ title: "Channel Data Error", description: `Could not load data: ${errorMsg}`, variant: "destructive" });
      anErrorOccurred = true;
    } finally {
      setChannelFetchProgress(prev => ({ ...prev, isLoading: false }));
      setIsLoadingResearchData(false);
    }
  }, [
    token, channelGroups, fetchVideoDataForGroup, videosPerPage, sortBy, uploadDateFilter, customDateStart, customDateEnd,
    durationMin, durationMax, viewsMin, viewsMax, likesMin, commentsMin, engagementRateMinVideo
  ]);

  // --- MODIFIED: fetchExpandedChannelDetails to accept an optional timeframe override ---
  const fetchExpandedChannelDetails = useCallback(async (channelId: string, channelHandle?: string, timeFrameOverride?: CompetitorTimeFrame) => {
    if (!token) return;
    setIsLoadingExpandedChannelDetails(true);
    const timeFrameToUse = timeFrameOverride || expandedModalTimeFrame; 
    try {
      const response = await axios.post(`${BACKEND_API_BASE_URL}/youtube/channel-data`, {
        channelIds: [channelId],
        channelHandles: channelHandle ? [channelHandle] : [null], // Ensure an array with null if no handle
        timeFrame: timeFrameToUse, 
        forceRefresh: true 
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (response.data && response.data.length > 0) {
        const freshData = response.data[0];
        if (timeFrameToUse === 'max') {
          // When fetching 'max' data, this is the authoritative source for dailyChartData for the modal.
          setExpandedChannel({
            ...freshData, // Spread all fresh data
            dailyChartData: freshData.dailyChartData && freshData.dailyChartData.length > 0 ? freshData.dailyChartData : [], // Prioritize fresh, fallback to empty array
            videosPublishedInPeriod: freshData.videosPublishedInPeriod, // Explicitly take from fresh 'max' data
            timeFrameUsed: 'max' // Ensure timeFrameUsed reflects 'max'
          });
        } else {
          // For other timeframes, we are likely refreshing based on existing 'max' dailyChartData.
          // So, we update the summary fields (viewsGained, subsGained for the new period)
          // but try to keep the comprehensive 'max' dailyChartData if it exists on expandedChannel.
          setExpandedChannel(prevExpandedChannel => ({
            ...freshData, // Contains period-specific views/subs gained for timeFrameToUse
            // Preserve existing 'max' dailyChartData if available and current fetch isn't 'max'
            dailyChartData: prevExpandedChannel?.timeFrameUsed === 'max' && prevExpandedChannel.dailyChartData && prevExpandedChannel.dailyChartData.length > 0 
                            ? prevExpandedChannel.dailyChartData 
                            : (freshData.dailyChartData || []), // Fallback to freshData's chart or empty
            timeFrameUsed: timeFrameToUse // Update to the specific timeframe fetched
          }));
        }
      } else {
        const existingChannelData = researchChannelData.find(c => c.id === channelId);
        if (existingChannelData) {
            setExpandedChannel({...existingChannelData, error: "Failed to load full details, showing available data."}) ;
            toast({ title: "Partial Data", description: "Could not load full details, showing available data.", variant: "default" });
        } else {
            toast({ title: "Error", description: "Could not load detailed channel data.", variant: "destructive" });
        }
      }
    } catch (error: any) {
      console.error(`[ResearchPage] Failed to fetch expanded details for channel ${channelId} with timeframe ${timeFrameToUse}:`, error);
      const existingChannelData = researchChannelData.find(c => c.id === channelId);
      if (existingChannelData) {
        setExpandedChannel({...existingChannelData, error: `Details error: ${error.response?.data?.message || error.message}`});
      } 
      toast({ title: "Error Loading Details", description: `Using cached data if possible. ${error.response?.data?.message || error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingExpandedChannelDetails(false);
    }
  }, [token, researchChannelData, expandedModalTimeFrame, expandedChannel]); // Added expandedChannel to deps for the merge logic

  const handleOpenExpandedModal = (channel: ApiChannelData) => {
    // Set the modal's internal timeframe selector first.
    // The dropdown will default to '28d' or whatever 'expandedModalTimeFrame' is initialized to if not 'max'.
    // We will fetch 'max' data for the chart foundation, then the modal can display various slices of it.
    
    const tableTimeFrame = channel.timeFrameUsed || competitorTimeFrame || '28d';
    // If the table was already showing 'max', or for some other reason we want the modal to start at 'max'
    // we can set it here. Otherwise, default to a common one like '28d'.
    // The actual data for chart will be 'max' due to the fetch below.
    setExpandedModalTimeFrame(tableTimeFrame === 'max' ? 'max' : '28d');

    // ALWAYS fetch fresh 'max' data when opening the modal to ensure the chart has the best possible underlying data.
    // The `expandedModalTimeFrame` state will then be used by `aggregateDataForModalTimeFrame`
    // to calculate stats for the *selected* timeframe using the comprehensive 'max' daily data.
    fetchExpandedChannelDetails(channel.id, channel.channelHandle, 'max');
    
    // Set a placeholder expandedChannel immediately so the modal can open.
    // The actual data will populate once fetchExpandedChannelDetails completes.
    setExpandedChannel({ 
        ...channel, // Spread existing channel data from the table row as a temporary display
        dailyChartData: [], // Clear any old chart data, will be filled by 'max' fetch
    });
    setIsExpandedModalOpen(true);
  };


  useEffect(() => {
    if (selectedGroupId && hasAttemptedFetch && token) {
      fetchChannelResearchApi(selectedGroupId, false, competitorTimeFrame);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, competitorTimeFrame, hasAttemptedFetch, token]); // Removed fetchChannelResearchApi from deps to avoid loops if its definition changes often

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
    setHasAttemptedFetch(true); // This will trigger the useEffect for data fetching
    // Explicitly call if hasAttemptedFetch was already true, to allow re-fetch with same params
    if (hasAttemptedFetch && selectedGroupId && token) {
         fetchChannelResearchApi(selectedGroupId, false, competitorTimeFrame);
    }
  };

  const handleRefreshData = () => {
    if (selectedGroupId) {
        setHasAttemptedFetch(true);
        fetchChannelResearchApi(selectedGroupId, true, competitorTimeFrame);
    } else {
        toast({ title: "No Group Selected", description: "Please select a channel group to refresh.", variant: "default"});
    }
  };

  const selectedGroupName = selectedGroupId ? channelGroups.find(g => g.id === selectedGroupId)?.name : null;
  const isLoadingGroupSelector = isLoadingPreferences && channelGroups.length === 0;

  // --- UPDATED: Derived state for sorted competitor channels ---
  const sortedCompetitorChannelData = React.useMemo(() => {
    let filteredData = [...researchChannelData];
    const minViews = parseInt(competitorViewsMin, 10);
    const maxViews = parseInt(competitorViewsMax, 10);

    if (!isNaN(minViews) && minViews > 0) {
      filteredData = filteredData.filter(c => c.viewsGainedInPeriod !== undefined && c.viewsGainedInPeriod >= minViews);
    }
    if (!isNaN(maxViews) && maxViews > 0) {
      filteredData = filteredData.filter(c => c.viewsGainedInPeriod !== undefined && c.viewsGainedInPeriod <= maxViews);
    }
    
    const sorted = filteredData.sort((a, b) => {
      let valA = a[competitorSortBy as keyof typeof a];
      let valB = b[competitorSortBy as keyof typeof b];

      if (competitorSortBy === 'name') {
        valA = a.name || '';
        valB = b.name || '';
        return competitorSortOrder === 'asc' ? (valA as string).localeCompare(valB as string) : (valB as string).localeCompare(valA as string);
      }
      
      if (valA == null && valB == null) return 0;
      if (valA == null) return competitorSortOrder === 'desc' ? 1 : -1;
      if (valB == null) return competitorSortOrder === 'desc' ? -1 : 1;

      return competitorSortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
    return sorted;
  }, [researchChannelData, competitorSortBy, competitorSortOrder, competitorViewsMin, competitorViewsMax]);

  const handleCompetitorSort = (column: 'name' | 'currentSubscriberCount' | 'viewsGainedInPeriod' | 'subsGainedInPeriod') => { 
    if (competitorSortBy === column) {
      setCompetitorSortOrder(competitorSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setCompetitorSortBy(column);
      setCompetitorSortOrder('desc');
    }
  };
  
  const displayedVideoData = researchVideoData;

  useEffect(() => {
    setTotalVideosInGrid(displayedVideoData.length);
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

  useEffect(() => {
    if (selectedGroupId && hasAttemptedFetch) {
      fetchVideoDataForGroup(
        selectedGroupId, 1, videosPerPage, sortBy, uploadDateFilter, customDateStart, customDateEnd, 
        durationMin, durationMax, viewsMin, viewsMax, likesMin, commentsMin, engagementRateMinVideo
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sortBy, uploadDateFilter, customDateStart, customDateEnd, durationMin, durationMax, viewsMin, viewsMax, 
    likesMin, commentsMin, engagementRateMinVideo,
    // Keep selectedGroupId and hasAttemptedFetch in the if condition, not necessarily in deps if their change is handled by other effects for initial load.
    // Re-adding selectedGroupId and hasAttemptedFetch to ensure re-fetch if they change and filters are already set.
    selectedGroupId, hasAttemptedFetch 
    // Removed fetchVideoDataForGroup to avoid loops. Its dependencies are stable or handled.
  ]);


  // --- NEW: Helper function for expanded modal chart data ---
  const getFilteredDailyDataForModal = () => {
    if (!expandedChannel || !expandedChannel.dailyChartData) {
      console.log("[ChartData] No expandedChannel or no dailyChartData. expandedChannel:", expandedChannel);
      return [];
    }
    // --- ADDED LOGGING ---
    console.log(
      `[ChartData] Processing dailyChartData for modal. Raw Length: ${expandedChannel.dailyChartData.length}, ModalTimeFrame: ${expandedModalTimeFrame}, ChannelDataTimeframe: ${expandedChannel.timeFrameUsed}`
    );
    if (expandedChannel.dailyChartData.length > 0) {
      console.log("[ChartData] Sample of raw dailyChartData (first 3):", JSON.stringify(expandedChannel.dailyChartData.slice(0, 3)));
    }
    // --- END ADDED LOGGING ---
    
    const { dailyChartData } = expandedChannel;
    let daysToInclude = Infinity;
    switch (expandedModalTimeFrame) {
        case '7d': daysToInclude = 7; break;
        case '28d': daysToInclude = 28; break;
        case '90d': daysToInclude = 90; break;
        case '365d': daysToInclude = 365; break;
        case 'max': daysToInclude = Infinity; break;
        default: daysToInclude = 28; // Default for safety
    }

    // Assuming dailyChartData is sorted latest first from backend, if not, sort it
    const sortedData = [...dailyChartData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const filteredChronological = sortedData.slice(0, daysToInclude).reverse(); // Take latest N, then reverse for chronological chart

    // MODIFIED: Filter out invalid dates before mapping and returning
    const result = filteredChronological
        .map(d => {
            // Validate the date string from the data object 'd'
            if (!d || !d.date || typeof d.date !== 'string' || d.date.trim() === "" || isNaN(new Date(d.date).getTime())) {
                console.error("[ChartData] Invalid or missing date in modal chart data object:", d, "(Channel:", expandedChannel?.name, expandedChannel?.id, "). Date value was:", d?.date);
                return null; // Mark for filtering out this data point
            }
            // If valid, format it for the chart
            return {
                date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                views: d.viewCountDelta ?? 0,
                subscribers: d.subscriberCountDelta ?? 0,
            };
        })
        .filter(item => item !== null); // Remove the null entries (where dates were invalid)
    
    // --- ADDED LOGGING ---
    console.log(`[ChartData] Mapped and filtered result for chart. Processed Length: ${result.length}`);
    if (result.length === 0 && expandedChannel.dailyChartData.length > 0) {
        console.warn(
            `[ChartData] Processed chart data is empty, but raw daily data (length ${expandedChannel.dailyChartData.length}) was present. ` +
            "This might indicate all dates were invalid or filtered out. First raw date string:", 
            expandedChannel.dailyChartData[0]?.date
        );
    }
    // --- END ADDED LOGGING ---
    return result;
  };

  const modalChartData = getFilteredDailyDataForModal();
  
  const aggregateDataForModalTimeFrame = () => {
    // Directly use the aggregated values from expandedChannel,
    // which should correspond to the expandedModalTimeFrame due to fetching logic.
    if (!expandedChannel) {
      return { 
        views: 0, 
        subs: 0,   
        videos: 'N/A' 
      };
    }
    
    // The expandedChannel.viewsGainedInPeriod, subsGainedInPeriod, and videosPublishedInPeriod
    // should have been populated by fetchExpandedChannelDetails for the currently selected
    // expandedModalTimeFrame.
    return {
        views: expandedChannel.viewsGainedInPeriod ?? 0,
        subs: expandedChannel.subsGainedInPeriod ?? 0,
        videos: expandedChannel.videosPublishedInPeriod !== undefined && expandedChannel.videosPublishedInPeriod !== null 
                ? expandedChannel.videosPublishedInPeriod 
                : 'N/A'
    };
  };
  const modalAggregatedStats = aggregateDataForModalTimeFrame();

  // --- NEW: useEffect to fetch data when modal timeframe changes ---
  useEffect(() => {
    // Only run if the modal is open, an expandedChannel is set (not initial placeholder state potentially),
    // an initial load isn't already happening, and the token is present.
    if (isExpandedModalOpen && expandedChannel && !isLoadingExpandedChannelDetails && token) {
      // Condition to refetch:
      // 1. The currently displayed data in `expandedChannel` is for a different timeframe than selected in modal's dropdown.
      // 2. OR, the data is for the same timeframe, but the dailyChartData is missing/empty (suggesting a failed/incomplete previous fetch for this timeframe).
      const needsRefetchForTimeFrame = expandedChannel.timeFrameUsed !== expandedModalTimeFrame;
      const currentDataMissingChart = expandedChannel.timeFrameUsed === expandedModalTimeFrame && 
                                      (!expandedChannel.dailyChartData || expandedChannel.dailyChartData.length === 0);

      // We also want to ensure we don't trigger this immediately on modal open if the initial 'max' fetch is already underway
      // or if the initial 'max' fetch successfully populated data for the current expandedModalTimeFrame (e.g., if it defaulted to 'max').
      // The `isLoadingExpandedChannelDetails` check helps with the former.
      // The primary purpose of this useEffect is for *user-initiated changes* of the modal timeframe dropdown.
      
      if (needsRefetchForTimeFrame || currentDataMissingChart) {
        // Avoid an immediate re-fetch if expandedChannel.id is null/undefined (might happen if placeholder is too minimal)
        if (expandedChannel.id) { 
            fetchExpandedChannelDetails(expandedChannel.id, expandedChannel.channelHandle, expandedModalTimeFrame);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedModalTimeFrame, isExpandedModalOpen, token, expandedChannel?.id, expandedChannel?.timeFrameUsed, expandedChannel?.dailyChartData, isLoadingExpandedChannelDetails]); 
  // Adding more granular dependencies from expandedChannel to ensure this effect re-evaluates correctly when those specific fields change after a fetch.
  // Removed expandedChannel object itself to prevent loops if other properties change.

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
            <div className="md:col-span-2 flex justify-end items-center">
                {/* Placeholder */}
            </div>
          </div>

          {!selectedGroupId && !isLoadingResearchData && !isLoadingGroupSelector && channelGroups.length > 0 && (
             <div className="mt-4 p-4 bg-neutral-700/50 border border-neutral-600 rounded-md text-center text-neutral-300">
                <Info className="h-5 w-5 inline-block mr-2 mb-1" />
                Please select a Niche Group above and click "Load Research Data".
            </div>
          )}

          {isLoadingResearchData && hasAttemptedFetch && (
            <div className="mt-6 flex justify-center items-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-trendy-yellow mr-3" />
              {channelFetchProgress.isLoading && channelFetchProgress.total > 0 ? (
                <span className="text-neutral-300">
                  {channelFetchProgress.currentChannelName || `Fetching data for ${channelFetchProgress.total} channels...`}
                </span>
              ) : (
                <span className="text-neutral-300">Loading research data...</span>
              )}
            </div>
          )}
          {researchDataError && !isLoadingResearchData && hasAttemptedFetch && (
            <div className="mt-6 p-4 bg-red-900/30 border border-red-700 rounded-md text-center text-red-300">
                <AlertCircle className="h-5 w-5 inline-block mr-2 mb-1" />
                Error: {researchDataError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accordion Sections */}
      {selectedGroupId && !isLoadingResearchData && !researchDataError && researchChannelData.length > 0 && hasAttemptedFetch && (
        <Accordion type="multiple" defaultValue={openSections} onValueChange={setOpenSections} className="space-y-4">
          {/* Competitor Channel Overview - REVAMPED */}
          <AccordionItem value="competitorChannelOverview" className="bg-neutral-800/60 border-neutral-700 rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline text-lg font-medium text-neutral-100 data-[state=open]:border-b data-[state=open]:border-neutral-700">
                <div className="flex items-center">
                    <Award className="h-5 w-5 mr-3 text-trendy-gold" /> Competitor Channel Overview
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-6 space-y-4">
              <div className="mb-4 p-3 bg-neutral-700/40 border border-neutral-600 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <Label htmlFor="competitorTimeFrame" className="text-xs text-neutral-400">Time Frame</Label>
                    <Select value={competitorTimeFrame} onValueChange={(value) => setCompetitorTimeFrame(value as CompetitorTimeFrame)}>
                      <SelectTrigger id="competitorTimeFrame" className="bg-neutral-600 border-neutral-500 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-200">
                        <SelectItem value="1d">Yesterday</SelectItem>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="28d">Last 28 Days</SelectItem>
                        <SelectItem value="90d">Last 3 Months</SelectItem>
                        <SelectItem value="365d">Last 1 Year</SelectItem>
                        <SelectItem value="max">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="competitorViewsMin" className="text-xs text-neutral-400">Min Views Gained</Label>
                    <Input id="competitorViewsMin" type="number" placeholder="e.g., 10000" value={competitorViewsMin} onChange={(e) => setCompetitorViewsMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70 text-sm" />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="competitorViewsMax" className="text-xs text-neutral-400">Max Views Gained</Label>
                    <Input id="competitorViewsMax" type="number" placeholder="e.g., 1000000" value={competitorViewsMax} onChange={(e) => setCompetitorViewsMax(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70 text-sm" />
                  </div>
                </div>
              </div>
              
              {sortedCompetitorChannelData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-sm text-left text-neutral-300">
                    <thead className="text-xs text-neutral-400 uppercase bg-neutral-700/50">
                      <tr>
                        <th scope="col" className="px-3 py-3 w-[3%]">#</th>
                        <th scope="col" className="px-3 py-3 w-[35%] cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('name')}>
                          Channel {competitorSortBy === 'name' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        <th scope="col" className="px-3 py-3 w-[15%] text-right cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('currentSubscriberCount')}>
                          Total Subs {competitorSortBy === 'currentSubscriberCount' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        <th scope="col" className="px-3 py-3 w-[20%] text-right cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('subsGainedInPeriod')}>
                          Subs Gained {competitorSortBy === 'subsGainedInPeriod' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        <th scope="col" className="px-3 py-3 w-[20%] text-right cursor-pointer hover:text-trendy-gold" onClick={() => handleCompetitorSort('viewsGainedInPeriod')}>
                          Views Gained {competitorSortBy === 'viewsGainedInPeriod' ? (competitorSortOrder === 'asc' ? <ChevronUp className="inline h-4 w-4"/> : <ChevronDown className="inline h-4 w-4"/>) : ''}
                        </th>
                        <th scope="col" className="px-3 py-3 w-[7%] text-center"> 
                           <Maximize2 className="inline h-4 w-4 text-neutral-500" aria-label="Expand details column"/>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCompetitorChannelData.map((channel, index) => (
                        <tr key={channel.id} className="border-b border-neutral-700 hover:bg-neutral-700/40">
                          <td className="px-3 py-2 text-neutral-400">{index + 1}</td>
                          <td scope="row" className="px-3 py-2 font-medium text-white whitespace-nowrap">
                            <div className="flex items-center gap-3">
                                {channel.thumbnailUrl && <img src={channel.thumbnailUrl} alt={channel.name} className="w-10 h-10 rounded-full border border-neutral-600"/>}
                                <div>
                                    <a 
                                        href={`https://www.youtube.com/${channel.channelHandle || `channel/${channel.id}`}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-trendy-gold transition-colors group hover:underline" 
                                        title={channel.name}
                                    >
                                        <span className="truncate max-w-[200px] block">{channel.name || 'Unnamed Channel'}</span> {/* Slightly increased max-width for channel name */}
                                    </a>
                                    {channel.channelHandle && <span className="text-xs text-neutral-400 truncate max-w-[200px] block">{channel.channelHandle}</span>}
                                    {/* The source and errorType are now generic strings - UPDATED CHECKS */}
                                    {channel.source === 'alternative_source_fallback' && (
                                        <p className="text-xs text-yellow-400 mt-0.5" title="Data for this channel is from an alternative source; period-specific growth figures may be limited.">Limited data (alt. source)</p>
                                    )}
                                    {channel.errorType === 'primary_source_not_found' && (
                                         <p className="text-xs text-orange-400 mt-0.5" title="This channel is not tracked by our primary analytics provider. Data shown is from an alternative source and may be limited.">Not tracked by primary (alt. source)</p>
                                    )}
                                     {channel.error && channel.errorType !== 'primary_source_not_found' && channel.errorType !== 'primary_source_api_error_no_fallback' && ( // Added another distinct error type to hide general message for if needed
                                        <p className="text-xs text-red-400 mt-0.5">Error: {channel.error}</p>
                                     )}
                                     {/* Specific message for when primary fails and fallback also fails, to avoid showing the full concatenated error directly */}
                                     {channel.errorType === 'primary_source_api_error_no_fallback' && (
                                         <p className="text-xs text-red-400 mt-0.5" title={channel.error}>Multiple data sources failed. See console for details.</p>
                                     )}
                                </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">{formatNumber(channel.currentSubscriberCount)}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(channel.subsGainedInPeriod, 1, true)}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(channel.viewsGainedInPeriod, 1, true)}</td>
                          <td className="px-3 py-2 text-center">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenExpandedModal(channel)} className="h-7 w-7 hover:bg-neutral-600" title="View Detailed Stats">
                                <ExternalLink className="h-4 w-4 text-neutral-400 hover:text-trendy-teal"/>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400">
                  <Info className="h-5 w-5 inline-block mr-2 mb-1" />
                  No channel data matches your filters or is available for this group.
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Content Discovery Grid (remains largely the same) */}
          <AccordionItem value="contentDiscoveryGrid" className="bg-neutral-800/60 border-neutral-700 rounded-lg">
            <AccordionTrigger className="px-6 py-4 hover:no-underline text-lg font-medium text-neutral-100 data-[state=open]:border-b data-[state=open]:border-neutral-700">
                <div className="flex items-center">
                    <Zap className="h-5 w-5 mr-3 text-trendy-teal" /> Content Discovery Grid
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-6">
              {/* Filters for the video grid */}
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

                  {uploadDateFilter === "custom_range" && (
                    <>
                      <div>
                        <Label htmlFor="customDateStart" className="text-xs text-neutral-400">Start Date</Label>
                        <Input id="customDateStart" type="date" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                      </div>
                      <div>
                        <Label htmlFor="customDateEnd" className="text-xs text-neutral-400">End Date</Label>
                        <Input id="customDateEnd" type="date" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                      </div>
                    </>
                  )}
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
                  <div>
                    <Label htmlFor="likesMin" className="text-xs text-neutral-400">Min Likes</Label>
                    <Input id="likesMin" type="number" placeholder="e.g., 1000" value={likesMin} onChange={(e) => setLikesMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                  </div>
                  <div>
                    <Label htmlFor="commentsMin" className="text-xs text-neutral-400">Min Comments</Label>
                    <Input id="commentsMin" type="number" placeholder="e.g., 100" value={commentsMin} onChange={(e) => setCommentsMin(e.target.value)} className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                  </div>
                  <div>
                    <Label htmlFor="engagementRateMinVideo" className="text-xs text-neutral-400">Min Video ER (%)</Label>
                    <Input id="engagementRateMinVideo" type="number" placeholder="e.g., 2.5" value={engagementRateMinVideo} onChange={(e) => setEngagementRateMinVideo(e.target.value)} step="0.1" className="bg-neutral-600 border-neutral-500 placeholder:text-neutral-400/70" />
                  </div>
                </div>
              </div>
              
              {/* Video Grid Area */}
              {displayedVideoData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayedVideoData.map((video) => {
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
                            <img src={video.thumbnail_url || 'https://placehold.co/400x225/262626/e5e5e5?text=No+Thumb'} alt={video.title || 'Video'} className="w-full h-auto object-cover aspect-video"/>
                            {video.duration_seconds > 0 && (
                                <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded z-10">
                                    {formatDuration(video.duration_seconds)}
                                </div>
                            )}
                            {video.channel_thumbnail_url && (
                                <img src={video.channel_thumbnail_url} alt="Channel PFP" className="absolute bottom-1 left-1 w-8 h-8 rounded-full border-2 border-neutral-800 z-10"/>
                            )}
                          </div>
                          <CardContent className="p-3 space-y-2 flex-grow flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-white group-hover:text-neutral-100 transition-colors line-clamp-2" title={video.title} style={{ minHeight: '2.5em' }}>
                                    {video.title || 'Untitled Video'}
                                </h3>
                            </div>
                            <div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-neutral-300 mb-2">
                                  <div className="flex items-center space-x-1"> <Eye size={14} className="text-neutral-400" /> <span>{formatNumber(video.latest_view_count, 0)} views</span> </div>
                                  <div className="flex items-center space-x-1"> <ThumbsUp size={14} className="text-neutral-400" /> <span>{formatNumber(video.latest_like_count, 0)} likes</span> </div>
                                  <div className="flex items-center space-x-1"> <MessageSquare size={14} className="text-neutral-400" /> <span>{formatNumber(video.latest_comment_count, 0)}</span> </div>
                                  <div className="flex items-center space-x-1"> <TrendingUp size={14} className="text-neutral-400" /> <span>{typeof calculatedEngagementRate === 'number' ? calculatedEngagementRate.toFixed(1) + '%' : 'N/A'}</span> </div>
                                </div>
                                {video.published_at && (
                                  <div className="flex items-center space-x-1 text-xs text-neutral-400 pt-1"> <Calendar size={14} className="text-neutral-500" /> <span>{new Date(video.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span> </div>
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
                  <Button onClick={() => handleVideoPageChange(videoCurrentPage - 1)} disabled={videoCurrentPage <= 1 || isLoadingResearchData} variant="outline" className="bg-neutral-600 hover:bg-neutral-500 border-neutral-500 disabled:opacity-50">Previous</Button>
                  <span className="text-neutral-300">Page {videoCurrentPage} of {Math.ceil(totalVideoItems / videosPerPage)}</span>
                  <Button onClick={() => handleVideoPageChange(videoCurrentPage + 1)} disabled={(videoCurrentPage * videosPerPage) >= totalVideoItems || isLoadingResearchData} variant="outline" className="bg-neutral-600 hover:bg-neutral-500 border-neutral-500 disabled:opacity-50">Next</Button>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Expanded Channel Stats Modal */}
      {expandedChannel && (
        <Dialog open={isExpandedModalOpen} onOpenChange={setIsExpandedModalOpen}>
          <DialogContent className="bg-neutral-800 border-neutral-700 text-neutral-200 sm:max-w-4xl p-0 max-h-[90vh] flex flex-col">
            {isLoadingExpandedChannelDetails ? (
                <div className="h-[500px] flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-trendy-yellow" />
                </div>
            ) : (
            <>
            <DialogHeader className="p-6 pb-4 border-b border-neutral-700 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {expandedChannel.thumbnailUrl && <img src={expandedChannel.thumbnailUrl} alt={expandedChannel.name} className="w-16 h-16 rounded-full border-2 border-neutral-600"/>}
                  <div>
                    <DialogTitle className="text-2xl font-semibold text-white flex items-center">
                        {expandedChannel.name}
                        <a href={`https://www.youtube.com/${expandedChannel.channelHandle || `channel/${expandedChannel.id}`}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-neutral-400 hover:text-trendy-gold">
                            <ExternalLink size={18}/>
                        </a>
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400 sr-only">
                      Detailed channel statistics and trends for {expandedChannel.name}. 
                      {expandedChannel.channelHandle && ` Handle: ${expandedChannel.channelHandle}.`}
                    </DialogDescription>
                    {expandedChannel.channelHandle && <p className="text-sm text-neutral-400">{expandedChannel.channelHandle}</p>}
                  </div>
                </div>
                <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-white hover:bg-neutral-700 absolute top-4 right-4">
                        <ChevronDown className="rotate-45 scale-150" />
                    </Button>
                </DialogClose>
              </div>
                <div className="mt-4">
                    <Label htmlFor="expandedModalTimeFrame" className="text-xs text-neutral-400">Chart & Stats Time Frame</Label>
                    <Select value={expandedModalTimeFrame} onValueChange={(value) => setExpandedModalTimeFrame(value as CompetitorTimeFrame)}>
                      <SelectTrigger id="expandedModalTimeFrame" className="bg-neutral-700 border-neutral-600 text-sm w-auto min-w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-200">
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="28d">Last 28 Days</SelectItem>
                        <SelectItem value="90d">Last 3 Months</SelectItem>
                        <SelectItem value="365d">Last 1 Year</SelectItem>
                        <SelectItem value="max">All Time (from available data)</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
            </DialogHeader>

            <div className="p-6 space-y-6 overflow-y-auto flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard title={`Views (${expandedModalTimeFrame})`} value={formatNumber(modalAggregatedStats.views, 1, true)} icon={<Eye className="text-teal-400"/>} />
                <StatCard title={`Subs (${expandedModalTimeFrame})`} value={formatNumber(modalAggregatedStats.subs, 1, true)} icon={<Users className="text-yellow-400"/>} />
              </div>

              {/* Charts */}
              {expandedChannel.dailyChartData && expandedChannel.dailyChartData.length > 0 ? (
                <div className="space-y-8">
                  {/* Views Chart */}
                  <div>
                    <h3 className="text-lg font-medium text-neutral-100 mb-3 flex items-center"><LineChartIcon className="mr-2 h-5 w-5 text-teal-400"/>Views Over Time ({expandedModalTimeFrame})</h3>
                    <Card className="bg-neutral-700/50 border-neutral-600 p-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={modalChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} stroke="#6b7280"/>
                          <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                          <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatNumber(value,0)} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '0.375rem' }} 
                            labelStyle={{ color: '#e5e7eb', fontWeight: 'bold' }} 
                            itemStyle={{color: '#d1d5db'}} 
                            formatter={(value: number) => [formatNumber(value,0), "Views"]}
                          />
                          <Legend wrapperStyle={{fontSize: "12px"}}/>
                          <Line type="monotone" dataKey="views" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} name="Views Gained"/>
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  {/* Subscribers Chart */}
                  <div>
                    <h3 className="text-lg font-medium text-neutral-100 mb-3 flex items-center"><Users className="mr-2 h-5 w-5 text-yellow-400"/>Subscribers Over Time ({expandedModalTimeFrame})</h3>
                     <Card className="bg-neutral-700/50 border-neutral-600 p-4">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={modalChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} stroke="#6b7280"/>
                          <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                          <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => formatNumber(value,0, true)} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#374151', border: 'none', borderRadius: '0.375rem' }} 
                            labelStyle={{ color: '#e5e7eb', fontWeight: 'bold' }} 
                            itemStyle={{color: '#d1d5db'}} 
                            formatter={(value: number) => [formatNumber(value,0,true), "Subscribers"]}
                          />
                          <Legend wrapperStyle={{fontSize: "12px"}}/>
                          <Line type="monotone" dataKey="subscribers" stroke="#facc15" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} name="Subscribers Gained"/>
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="text-neutral-400 text-center py-10">No daily chart data available for this channel or timeframe.</p>
              )}
            </div>
            </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
