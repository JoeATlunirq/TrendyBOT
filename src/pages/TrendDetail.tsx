import React from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, ChevronLeft, ChevronUp, Clock, ExternalLink, LineChart, MoreHorizontal, Share2, Star, TrendingUp, UserPlus, Users, Youtube, BellRing } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Text } from 'recharts';

// Sample trend detail data
const getTrendById = (id: string) => {
  const videoId = parseInt(id);
  
  // Mock data for the requested video
  const videoData = {
    id: videoId,
    title: "NEW iPhone 15 Pro Unboxing Experience!",
    description: "Check out my first impressions of the new iPhone 15 Pro! This device is packed with incredible features and the unboxing experience is next level.",
    channel: "TechReviewPro",
    channelId: "tech123",
    channelSubs: "2.5M",
    views: 450000,
    viewsGrowth: 320,
    likes: 42000,
    likesGrowth: 42,
    comments: 8500,
    commentsGrowth: 38,
    shares: 15000,
    sharesGrowth: 45,
    published: "2023-04-15T14:30:00Z",
    detected: "2023-04-15T14:45:00Z",
    minutesLive: 45,
    thumbnail: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=techreview",
    category: "Tech",
    keywords: ["iPhone 15", "Apple", "Unboxing", "Tech Review", "Smartphone"],
    history: [
      { time: "14:30", views: 1000, likes: 120, comments: 20 },
      { time: "14:45", views: 5000, likes: 450, comments: 85 },
      { time: "15:00", views: 20000, likes: 2200, comments: 320 },
      { time: "15:15", views: 45000, likes: 4800, comments: 750 },
      { time: "15:30", views: 89000, likes: 9500, comments: 1400 },
      { time: "15:45", views: 150000, likes: 16800, comments: 2700 },
      { time: "16:00", views: 240000, likes: 25000, comments: 4200 },
      { time: "16:15", views: 320000, likes: 34000, comments: 6100 },
      { time: "16:30", views: 450000, likes: 42000, comments: 8500 },
    ],
    similarTrends: [
      { id: 101, title: "iPhone 15 vs Samsung S23 - Which is Better?", views: 380000, growth: 280 },
      { id: 102, title: "Top 5 iPhone 15 Pro Features You Need to Know", views: 290000, growth: 230 },
      { id: 103, title: "Apple's New Design Direction Explained", views: 210000, growth: 190 },
    ]
  };

  return videoData;
};

// Chart Styling (copied from History.tsx, adjust if needed)
const tickStyle = { fontSize: '0.75rem', fill: '#a1a1aa' }; // neutral-400
const gridStyle = { stroke: '#404040' }; // neutral-700
const tooltipStyle = { 
    backgroundColor: '#262626', // neutral-800 
    borderColor: '#525252', // neutral-600
    color: '#e5e5e5' // neutral-200
};
const tooltipCursorStyle = { fill: 'rgba(113, 113, 122, 0.2)' }; // neutral-500 opacity 20%

const TrendDetail = () => {
  const { id } = useParams<{ id: string }>();
  const trend = getTrendById(id || "1");

  return (
    // Apply theme background and text color
    <div className="space-y-6 text-neutral-200">
      <div className="flex items-center gap-2">
         {/* Style Button */}
        <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50" asChild>
          <Link to="/trending">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
         {/* Style Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-white font-orbitron">Trend Details</h1>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video details section - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video preview card: Apply dark theme */}
          <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
            <div className="relative">
              <img 
                src={trend.thumbnail} 
                alt={trend.title}
                className="w-full aspect-video object-cover rounded-t-lg"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                 {/* Badge Styles */}
                <Badge className="bg-neutral-700/60 border-neutral-600 text-neutral-300">
                  {trend.category}
                </Badge>
                <Badge className="bg-trendy-yellow text-trendy-brown border-trendy-yellow">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {trend.viewsGrowth}% growth
                </Badge>
              </div>
               {/* Play Button Style - Keep primary color focus */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Button size="lg" className="bg-trendy-yellow/90 hover:bg-trendy-yellow rounded-full w-16 h-16 flex items-center justify-center text-trendy-brown">
                  <div className="ml-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                      <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                    </svg>
                  </div>
                </Button>
              </div>
            </div>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-2">
                   {/* Text Styles */}
                  <h2 className="text-2xl font-semibold text-white">{trend.title}</h2>
                  <div className="flex items-center gap-3">
                     {/* Avatar Style */}
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={trend.channelIcon} alt={trend.channel} />
                      <AvatarFallback className="bg-neutral-600 text-neutral-300">{trend.channel[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-neutral-100">{trend.channel}</div>
                      <div className="text-sm text-neutral-400 flex items-center">
                        <Users className="h-3.5 w-3.5 mr-1.5" />
                        {trend.channelSubs} subscribers
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-4 md:mt-0">
                   {/* Button Styles */}
                  <Button variant="outline" className="w-full sm:w-auto border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on YouTube
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Follow Channel
                  </Button>
                  <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50">
                    <Share2 className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50">
                    <Star className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              
              {/* Separator Style */}
              <Separator className="my-6 bg-neutral-700/50" />
              
              {/* Stats Grid: Style background boxes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Views Stat */}
                <div className="bg-neutral-700/60 border border-neutral-600 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{(trend.views / 1000).toFixed(0)}k</div>
                  <div className="text-sm text-neutral-400 mt-1">Views</div>
                  <div className="text-xs flex items-center justify-center text-green-400 mt-1">
                    <ChevronUp className="h-3 w-3 mr-1" />
                    {trend.viewsGrowth}%
                  </div>
                </div>
                {/* Likes Stat */}
                <div className="bg-neutral-700/60 border border-neutral-600 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{(trend.likes / 1000).toFixed(1)}k</div>
                  <div className="text-sm text-neutral-400 mt-1">Likes</div>
                  <div className="text-xs flex items-center justify-center text-green-400 mt-1">
                    <ChevronUp className="h-3 w-3 mr-1" />
                    {trend.likesGrowth}%
                  </div>
                </div>
                {/* Comments Stat */}
                <div className="bg-neutral-700/60 border border-neutral-600 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{(trend.comments / 1000).toFixed(1)}k</div>
                  <div className="text-sm text-neutral-400 mt-1">Comments</div>
                  <div className="text-xs flex items-center justify-center text-green-400 mt-1">
                    <ChevronUp className="h-3 w-3 mr-1" />
                    {trend.commentsGrowth}%
                  </div>
                </div>
                {/* Age Stat */}
                <div className="bg-neutral-700/60 border border-neutral-600 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-white">{trend.minutesLive}m</div>
                  <div className="text-sm text-neutral-400 mt-1">Age</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Time since publish
                  </div>
                </div>
              </div>
              
              {/* Description Section */}
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2 text-white">Description</h3>
                <p className="text-neutral-400">
                  {trend.description}
                </p>
              </div>
              
              {/* Keywords Section */}
              <div className="mt-4 flex flex-wrap gap-2">
                {trend.keywords.map((keyword, i) => (
                  <Badge key={i} variant="secondary" className="bg-neutral-700/60 border-neutral-600 text-neutral-300">
                    #{keyword}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Growth chart: Apply dark theme */}
          <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white font-orbitron">Growth Performance</CardTitle>
                  <CardDescription className="text-neutral-400">
                    View how this Shorts video has grown since publication
                  </CardDescription>
                </div>
                {/* Tab Styles */}
                <Tabs defaultValue="views">
                  <TabsList className="bg-neutral-700/80 border border-neutral-600 p-1 h-auto">
                    <TabsTrigger value="views" className="data-[state=active]:bg-neutral-600 data-[state=active]:text-white text-neutral-400 text-xs">Views</TabsTrigger>
                    <TabsTrigger value="engagement" className="data-[state=active]:bg-neutral-600 data-[state=active]:text-white text-neutral-400 text-xs">Engagement</TabsTrigger>
                    <TabsTrigger value="velocity" className="data-[state=active]:bg-neutral-600 data-[state=active]:text-white text-neutral-400 text-xs">Velocity</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                   {/* Chart Style */}
                  <AreaChart
                    data={trend.history}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }} // Adjust left margin for YAxis labels
                  >
                    <defs>
                      <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F6D44C" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#F6D44C" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStyle.stroke} />
                    <XAxis dataKey="time" tick={tickStyle} />
                    <YAxis tick={tickStyle} />
                    <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursorStyle} />
                    <Area type="monotone" dataKey="views" stroke="#F6D44C" fillOpacity={1} fill="url(#colorViews)" strokeWidth={2} name="Views" dot={false} activeDot={{ r: 6, fill: '#F6D44C' }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between items-center">
                {/* Text Styles */}
                <div className="text-sm text-neutral-500">
                  <Clock className="inline-block h-4 w-4 mr-1 mb-1" />
                  First detected 5 minutes after publishing
                </div>
                <div className="text-sm flex items-center text-neutral-400">
                  <LineChart className="h-4 w-4 mr-1" />
                  <span className="text-green-400 font-medium">
                    Outperforming 92% of similar videos
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

           {/* Alert Style */}
          <Alert className="border-green-700/50 bg-green-900/20 text-green-300">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertTitle className="text-green-200">Growth threshold met</AlertTitle>
            <AlertDescription className="text-green-300/80">
              This video exceeded your configured thresholds for views and engagement, triggering a notification.
            </AlertDescription>
          </Alert>
        </div>

        {/* Sidebar section - 1/3 width */}
        <div className="space-y-6">
          {/* Detection info card: Apply dark theme */}
          <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-white font-orbitron">Detection Details</CardTitle>
              <CardDescription className="text-neutral-400">
                How trendy identified this trend
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                 {/* Text & Badge Styles */}
                <div className="text-sm font-medium text-neutral-300">Trigger Type</div>
                <Badge className="bg-trendy-yellow text-trendy-brown border-trendy-yellow" variant="default">
                  <TrendingUp className="h-3 w-3 mr-1.5" />
                  Velocity Threshold
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-neutral-300">Detection Time</div>
                <div className="text-sm text-neutral-100">5 minutes after publishing</div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm font-medium text-neutral-300">Views Growth Rate</div>
                  <div className="text-sm text-white">320% / hour</div>
                </div>
                 {/* Progress Bar Style */}
                <Progress value={85} className="h-2 bg-neutral-700 [&>div]:bg-trendy-yellow" />
                <div className="text-xs text-neutral-500 flex justify-between">
                  <span>Your threshold: 100%</span>
                  <span className="text-green-400">220% above threshold</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm font-medium text-neutral-300">Engagement Rate</div>
                  <div className="text-sm text-white">42%</div>
                </div>
                 {/* Progress Bar Style */}
                <Progress value={75} className="h-2 bg-neutral-700 [&>div]:bg-trendy-yellow" />
                <div className="text-xs text-neutral-500 flex justify-between">
                  <span>Your threshold: 15%</span>
                  <span className="text-green-400">27% above threshold</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Similar trends card: Apply dark theme */}
          <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-white font-orbitron">Similar Trending Videos</CardTitle>
              <CardDescription className="text-neutral-400">
                Related content also gaining traction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {trend.similarTrends.map((similar) => (
                <div key={similar.id} className="flex items-start gap-3">
                  {/* Thumbnail placeholder style */}
                  <div className="w-20 h-12 bg-neutral-700 border border-neutral-600 rounded-md flex-shrink-0 relative overflow-hidden">
                    {/* Using actual image - keep as is */} 
                     <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <Youtube className="h-4 w-4 text-neutral-300" />
                    </div>
                  </div>
                  <div className="flex-1">
                    {/* Text Styles */}
                    <h4 className="text-sm font-medium line-clamp-2 text-white">{similar.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-neutral-400">
                        {(similar.views / 1000).toFixed(0)}K views
                      </span>
                      {/* Badge Style */} 
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4 bg-neutral-700/60 border-neutral-600 text-neutral-300">
                        {similar.growth}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter>
              {/* Button Style */}
              <Button variant="ghost" size="sm" className="w-full text-sm text-trendy-yellow hover:text-trendy-yellow hover:bg-neutral-700/50">
                View more similar trends
              </Button>
            </CardFooter>
          </Card>

          {/* Actions card: Apply dark theme */}
          <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
            <CardHeader>
              <CardTitle className="text-white font-orbitron">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
               {/* Button Styles */}
              <Button className="w-full bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold justify-start">
                <BellRing className="h-4 w-4 mr-2" />
                Create similar alert
              </Button>
              <Button variant="outline" className="w-full justify-start border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                <Share2 className="h-4 w-4 mr-2" />
                Share trend report
              </Button>
              <Button variant="outline" className="w-full justify-start border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                <ExternalLink className="h-4 w-4 mr-2" />
                View on YouTube
              </Button>
              <Button variant="outline" className="w-full justify-start border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                <Youtube className="h-4 w-4 mr-2" />
                Analyze channel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TrendDetail;
