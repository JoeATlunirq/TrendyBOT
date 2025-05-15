import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpRight, ChevronUp, Clock, ExternalLink, Filter, Search, Share2, TrendingUp, Users, Youtube, AlertTriangle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import axios from 'axios';

// Helper to format time since (simplified)
const timeSince = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const Trending = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("triggered_at");

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('trendly_token');
        if (!token) {
          setError(new Error('Not authenticated. Please log in.'));
          setLoading(false);
          return;
        }

        const response = await axios.get('/api/trends/my-alerts', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setAlerts(response.data.alerts || []);
      } catch (err) {
        console.error("Error fetching alerts:", err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch alerts.');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  // Adapt videos to match the structure expected by the rendering logic.
  // The API returns alert objects. We need to map them.
  const mappedAlerts = alerts.map(alert => ({
    id: alert.Id, // NocoDB primary key for the alert
    title: alert.video_title || 'N/A',
    channel: alert.channel_name || 'N/A',
    channelSubs: "N/A", // This data isn't in TriggeredAlerts table
    views: alert.views_at_trigger || 0,
    // Growth figures are not directly available from TriggeredAlerts, default or remove
    viewsGrowth: alert.parameters_matched?.min_views ? parseFloat(alert.parameters_matched.min_views.match(/\d+/)?.[0] || '0') : 0, // Attempt to parse if available
    likesGrowth: 0, // Not directly available
    commentsGrowth: 0, // Not directly available
    time: timeSince(alert.triggered_at),
    minutesLive: alert.published_at ? Math.round((new Date(alert.triggered_at).getTime() - new Date(alert.published_at).getTime()) / 60000) : 0,
    thumbnail: alert.thumbnail_url || "https://via.placeholder.com/320x180?text=No+Thumbnail",
    channelIcon: `https://ui-avatars.com/api/?name=${encodeURIComponent(alert.channel_name || 'N')}&background=random`, // Placeholder icon
    category: alert.group_name || "N/A", // Use group_name as category
    youtube_video_id: alert.video_id, // Keep original youtube video id
    parameters_matched: alert.parameters_matched ? JSON.parse(alert.parameters_matched) : {}
  }));

  // Filter videos based on search
  const filteredAlerts = mappedAlerts.filter(alert => {
    const matchesSearch = 
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.channel.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesSearch;
  });

  // Sort videos based on selected option
  const sortedAlerts = [...filteredAlerts].sort((a, b) => {
    if (sortOption === "triggered_at") {
      // Find original alerts to sort by date string
      const alertA = alerts.find(al => al.Id === a.id);
      const alertB = alerts.find(al => al.Id === b.id);
      return new Date(alertB.triggered_at).getTime() - new Date(alertA.triggered_at).getTime();
    } else if (sortOption === "views_at_trigger") {
      return b.views - a.views; // Sort by views at trigger time
    }
    // Add other relevant sort options based on available data
    return 0;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-trendy-yellow" />
        <p className="ml-4 text-xl text-neutral-300">Loading trending alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-64 bg-neutral-800/50 p-8 rounded-lg border border-red-500/50">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-2xl font-semibold text-red-400 mb-2">Error Fetching Alerts</h2>
        <p className="text-neutral-300 text-center">{typeof error === 'string' ? error : error.message}</p>
        <Button onClick={() => window.location.reload()} className="mt-6 bg-red-500 hover:bg-red-600 text-white">
          Try Again
        </Button>
      </div>
    );
  }
  
  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 bg-neutral-800/50 p-8 rounded-lg border border-neutral-700">
        <TrendingUp className="h-12 w-12 text-neutral-500 mb-4" />
        <h2 className="text-2xl font-semibold text-neutral-300 mb-2">No Alerts Yet</h2>
        <p className="text-neutral-400 text-center">It looks like no trends have matched your alert criteria yet. <br/> Check back later or adjust your alert preferences.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-neutral-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-orbitron">Triggered Video Alerts</h1>
          <p className="text-neutral-400">
            Videos that matched your alert criteria.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-[180px] bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
              <SelectItem value="triggered_at" className="focus:bg-neutral-700 focus:text-white">Most Recent Alert</SelectItem>
              <SelectItem value="views_at_trigger" className="focus:bg-neutral-700 focus:text-white">Most Views (at trigger)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input
                placeholder="Search alerted videos or channels"
                className="pl-9 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trending Videos Grid */}
      <Tabs defaultValue="grid">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-neutral-400">
            Showing {sortedAlerts.length} triggered alerts
          </p>
          <TabsList className="bg-neutral-800/50 border border-neutral-700/50 p-1 h-auto">
            <TabsTrigger value="grid" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Grid</TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">List</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grid" className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedAlerts.map((alertItem) => (
              <Card key={alertItem.id} className="overflow-hidden flex flex-col h-full bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg text-neutral-200">
                <div className="relative">
                  <img 
                    src={alertItem.thumbnail} 
                    alt={alertItem.title} 
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-black/70 hover:bg-black/70 flex items-center text-white border-none">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {alertItem.category !== "N/A" ? alertItem.category : (Object.keys(alertItem.parameters_matched)[0] || 'Matched')}
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="bg-neutral-700/60 border-neutral-600 text-neutral-300">
                      {alertItem.category}
                    </Badge>
                  </div>
                </div>
                <CardContent className="py-4 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="w-9 h-9 rounded-full">
                      <AvatarImage src={alertItem.channelIcon} />
                      <AvatarFallback className="bg-neutral-600 text-neutral-300">{alertItem.channel[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium line-clamp-2 mb-1 text-white">{alertItem.title}</h3>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-neutral-700/60 border border-neutral-600 rounded p-2 text-center">
                      <div className="text-sm font-medium text-white">{(alertItem.views / 1000).toFixed(0)}k</div>
                      <div className="text-xs text-neutral-400">Views (Trigger)</div>
                    </div>
                    <div className="bg-neutral-700/60 border border-neutral-600 rounded p-2 text-center">
                      <div className="text-sm font-medium flex items-center justify-center text-white">
                        {(alertItem.parameters_matched?.min_likes || alerts.find(al => al.Id === alertItem.id)?.likes_at_trigger || 'N/A')}
                      </div>
                      <div className="text-xs text-neutral-400">Likes (Trigger)</div>
                    </div>
                    <div className="bg-neutral-700/60 border border-neutral-600 rounded p-2 text-center">
                      <div className="text-sm font-medium text-white">{alertItem.minutesLive > 0 ? `${alertItem.minutesLive}m` : 'N/A'}</div>
                      <div className="text-xs text-neutral-400">Video Age</div>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="text-xs text-neutral-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Alert: {alertItem.time}
                    </div>
                    <Button size="sm" variant="outline" asChild className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                      <Link to={`/trend-detail/${alertItem.id}`}>
                        Details
                        <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
            <CardContent className="pt-6 px-2">
              <div className="space-y-2">
                {sortedAlerts.map((alertItem) => (
                  <div 
                    key={alertItem.id} 
                    className="flex flex-col sm:flex-row gap-4 p-4 border border-neutral-700/80 rounded-lg hover:bg-neutral-700/40 transition-colors"
                  >
                    <div className="sm:w-48 md:w-60 flex-shrink-0 relative">
                      <img 
                        src={alertItem.thumbnail} 
                        alt={alertItem.title}
                        className="w-full aspect-video object-cover rounded-md"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        <TrendingUp className="h-3 w-3 inline mr-1" />
                        Triggered
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium line-clamp-2 text-white">{alertItem.title}</h3>
                        <Badge variant="secondary" className="whitespace-nowrap flex-shrink-0 bg-neutral-700/60 border-neutral-600 text-neutral-300">
                          {alertItem.category}
                        </Badge>
                      </div>
                      <div className="flex items-center mt-2 gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={alertItem.channelIcon} />
                          <AvatarFallback>{alertItem.channel[0]}</AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3">
                        <span className="text-sm text-neutral-400 flex items-center">
                          <Youtube className="h-3.5 w-3.5 mr-1" />
                          {(alertItem.views / 1000).toFixed(0)}K views (trigger)
                        </span>
                        <span className="text-sm text-neutral-400 flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          Alert: {alertItem.time}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-xs text-neutral-500">Parameters: {Object.keys(alertItem.parameters_matched).join(', ') || 'N/A'}</div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50" onClick={() => navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${alertItem.youtube_video_id}`)}>
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" asChild className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50">
                            <a href={`https://www.youtube.com/watch?v=${alertItem.youtube_video_id}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                            <Link to={`/trend-detail/${alertItem.id}`}>
                              Details
                              <ArrowUpRight className="ml-1 h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Trending;
