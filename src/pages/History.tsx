import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { History as HistoryIcon, Filter, Trash2, Clock, Youtube, ArrowUpRight, Calendar, FileDown, Eye, ThumbsUp, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Text } from "recharts";

// Sample data for viewed trends
const viewedTrends = [
  {
    id: 1,
    title: "NEW iPhone 15 Pro Unboxing Experience!",
    channel: "TechReviewPro",
    viewedAt: "Today, 12:30 PM",
    thumbnail: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=techreview",
    viewStats: [
      { day: "Mon", views: 105000 },
      { day: "Tue", views: 195000 },
      { day: "Wed", views: 290000 },
      { day: "Thu", views: 430000 },
      { day: "Fri", views: 450000 }
    ],
    views: 450000,
    likes: 52000,
    comments: 3800
  },
  {
    id: 2,
    title: "5 Minute Ab Workout That ACTUALLY Works",
    channel: "FitLifeGuru",
    viewedAt: "Yesterday, 8:15 AM",
    thumbnail: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=fitlife",
    viewStats: [
      { day: "Mon", views: 75000 },
      { day: "Tue", views: 115000 },
      { day: "Wed", views: 135000 },
      { day: "Thu", views: 175000 },
      { day: "Fri", views: 195000 }
    ],
    views: 195000,
    likes: 26000,
    comments: 1200
  },
  {
    id: 3,
    title: "Easy Delicious 1-Minute Breakfast Hack",
    channel: "ChefCooksPro",
    viewedAt: "April 14, 3:45 PM",
    thumbnail: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=chefcooks",
    viewStats: [
      { day: "Mon", views: 140000 },
      { day: "Tue", views: 180000 },
      { day: "Wed", views: 240000 },
      { day: "Thu", views: 290000 },
      { day: "Fri", views: 320000 }
    ],
    views: 320000,
    likes: 38000,
    comments: 2500
  }
];

// Sample data for alerts
const alertHistory = [
  {
    id: 1,
    name: "Tech trends alert",
    createdAt: "April 15, 2025",
    sentAt: "Today, 10:30 AM",
    count: 3,
    category: "Tech",
    threshold: "200K views in 2 hours",
    videos: [
      { title: "NEW iPhone 15 Pro Unboxing Experience!", channel: "TechReviewPro" },
      { title: "This AI Feature Will Change Everything", channel: "TechInsider" }
    ],
    deliveredTo: ["Telegram", "Email"]
  },
  {
    id: 2,
    name: "Fitness content monitoring",
    createdAt: "April 10, 2025",
    sentAt: "Yesterday, 9:15 AM",
    count: 5,
    category: "Fitness",
    threshold: "150K views in 3 hours",
    videos: [
      { title: "5 Minute Ab Workout That ACTUALLY Works", channel: "FitLifeGuru" },
      { title: "This 30-Day Challenge Changed My Body", channel: "FitnessWithMark" }
    ],
    deliveredTo: ["Discord", "Email"]
  },
  {
    id: 3,
    name: "Food trends watcher",
    createdAt: "April 5, 2025",
    sentAt: "April 14, 11:30 AM",
    count: 2,
    category: "Food",
    threshold: "100K views in 1 hour",
    videos: [
      { title: "Easy Delicious 1-Minute Breakfast Hack", channel: "ChefCooksPro" },
      { title: "5 Budget Meals Under $2", channel: "BudgetEats" }
    ],
    deliveredTo: ["Telegram"]
  }
];

// Chart data for overall history
const overallHistoryData = [
  { date: "Apr 10", alerts: 2, views: 240 },
  { date: "Apr 11", alerts: 3, views: 320 },
  { date: "Apr 12", alerts: 1, views: 180 },
  { date: "Apr 13", alerts: 4, views: 390 },
  { date: "Apr 14", alerts: 3, views: 340 },
  { date: "Apr 15", alerts: 5, views: 420 },
  { date: "Apr 16", alerts: 2, views: 280 },
];

// Chart Styling
const tickStyle = { fontSize: '0.75rem', fill: '#a1a1aa' }; // neutral-400
const gridStyle = { stroke: '#404040' }; // neutral-700
const tooltipStyle = { 
    backgroundColor: '#262626', // neutral-800 
    borderColor: '#525252', // neutral-600
    color: '#e5e5e5' // neutral-200
};
const tooltipCursorStyle = { fill: 'rgba(113, 113, 122, 0.2)' }; // neutral-500 opacity 20%

// Components
const MiniChart = ({ data }: { data: { day: string; views: number }[] }) => (
  <ResponsiveContainer width="100%" height={60}>
    <LineChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
      <Line type="monotone" dataKey="views" stroke="#F6D44C" strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

const TrendCard = ({ trend }: { trend: typeof viewedTrends[0] }) => (
  <Card className="hover:border-trendy-yellow/30 transition-all duration-200 bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg text-neutral-200">
    <CardContent className="p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-48 flex-shrink-0">
          <div className="relative rounded-md overflow-hidden">
            <img 
              src={trend.thumbnail} 
              alt={trend.title}
              className="w-full aspect-video object-cover"
            />
            <Badge className="absolute top-2 right-2 bg-black/70 hover:bg-black/70 border-none text-white">
              <Eye className="h-3 w-3 mr-1" /> {(trend.views / 1000).toFixed(0)}K
            </Badge>
          </div>
          
          <div className="mt-2">
            <MiniChart data={trend.viewStats} />
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-medium line-clamp-1 text-white">{trend.title}</h3>
              <div className="flex items-center mt-1 gap-2">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={trend.channelIcon} />
                  <AvatarFallback className="bg-neutral-600 text-neutral-300 text-xs">{trend.channel[0]}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-neutral-400">{trend.channel}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50" asChild>
              <Link to={`/trending/${trend.id}`}>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-neutral-700/60 border border-neutral-600 rounded-md p-2 text-center flex flex-col items-center">
              <Eye className="h-3.5 w-3.5 mb-1 text-neutral-500" />
              <div className="text-sm font-medium text-white">{(trend.views / 1000).toFixed(0)}K</div>
              <div className="text-xs text-neutral-400">Views</div>
            </div>
            <div className="bg-neutral-700/60 border border-neutral-600 rounded-md p-2 text-center flex flex-col items-center">
              <ThumbsUp className="h-3.5 w-3.5 mb-1 text-neutral-500" />
              <div className="text-sm font-medium text-white">{(trend.likes / 1000).toFixed(0)}K</div>
              <div className="text-xs text-neutral-400">Likes</div>
            </div>
            <div className="bg-neutral-700/60 border border-neutral-600 rounded-md p-2 text-center flex flex-col items-center">
              <MessageSquare className="h-3.5 w-3.5 mb-1 text-neutral-500" />
              <div className="text-sm font-medium text-white">{(trend.comments / 1000).toFixed(1)}K</div>
              <div className="text-xs text-neutral-400">Comments</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-neutral-500 flex items-center">
              <Clock className="h-3.5 w-3.5 mr-1" />
              Viewed: {trend.viewedAt}
            </div>
            <Button variant="outline" size="sm" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                View Details
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const AlertCard = ({ alert }: { alert: typeof alertHistory[0] }) => (
  <Card className="hover:border-trendy-yellow/30 transition-all duration-200 bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg text-neutral-200">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-white">{alert.name}</h3>
          <div className="flex items-center mt-1 gap-2">
            <Badge variant="secondary" className="bg-neutral-700/60 border-neutral-600 text-neutral-300">{alert.category}</Badge>
            <span className="text-xs text-neutral-500">Created: {alert.createdAt}</span>
          </div>
        </div>
        <Badge variant="secondary" className="bg-neutral-700/60 border-neutral-600 text-neutral-300">{alert.count} alerts</Badge>
      </div>
      
      <Separator className="my-3 bg-neutral-700/50" />
      
      <div className="space-y-2">
        <div className="text-sm font-medium text-white">Triggered videos:</div>
        {alert.videos.map((video, idx) => (
          <div key={idx} className="bg-neutral-700/60 border border-neutral-600 rounded-md p-2">
            <div className="text-sm font-medium line-clamp-1 text-neutral-100">{video.title}</div>
            <div className="text-xs text-neutral-400">{video.channel}</div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-sm">
        <span className="text-neutral-400">Threshold:</span> {alert.threshold}
      </div>
      
      <div className="mt-3 flex items-center">
        <span className="text-sm text-neutral-400 mr-2">Delivered to:</span>
        <div className="flex gap-1">
          {alert.deliveredTo.map((channel, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs bg-neutral-700/60 border-neutral-600 text-neutral-300">
              {channel}
            </Badge>
          ))}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-neutral-500 flex items-center">
          <HistoryIcon className="h-3.5 w-3.5 mr-1" />
          Last sent: {alert.sentAt}
        </div>
        <Button variant="outline" size="sm" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
            View Details
        </Button>
      </div>
    </CardContent>
  </Card>
);

export default function History() {
  const [period, setPeriod] = useState("week");
  const [exportFormat, setExportFormat] = useState("csv");
  
  return (
    <div className="space-y-6 text-neutral-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-orbitron">History</h1>
          <p className="text-neutral-400">
            View your recent activity, alerts, and engagement over time
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow">
              <Calendar className="h-4 w-4 mr-2 text-neutral-400" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
              <SelectItem value="week" className="focus:bg-neutral-700 focus:text-white">Last Week</SelectItem>
              <SelectItem value="month" className="focus:bg-neutral-700 focus:text-white">Last Month</SelectItem>
              <SelectItem value="quarter" className="focus:bg-neutral-700 focus:text-white">Last Quarter</SelectItem>
              <SelectItem value="year" className="focus:bg-neutral-700 focus:text-white">Last Year</SelectItem>
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
              <DropdownMenuItem onClick={() => setExportFormat("csv")} className="focus:bg-neutral-700 focus:text-white">
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExportFormat("pdf")} className="focus:bg-neutral-700 focus:text-white">
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300 border-red-700/50 bg-red-900/20 hover:bg-red-900/40">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear History
          </Button>
        </div>
      </div>

      <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl text-white font-orbitron">Activity Overview</CardTitle>
          <CardDescription className="text-neutral-400">
            Your alerts and view counts over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overallHistoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStyle.stroke} />
                <XAxis dataKey="date" tick={tickStyle} />
                <YAxis yAxisId="left" orientation="left" stroke="#F6D44C" tick={tickStyle} />
                <YAxis yAxisId="right" orientation="right" stroke="#a1a1aa" tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursorStyle} />
                <Line yAxisId="left" type="monotone" dataKey="alerts" stroke="#F6D44C" strokeWidth={2} name="Alerts Triggered" dot={{ r: 4, fill: '#F6D44C' }} activeDot={{ r: 6, fill: '#F6D44C' }} />
                <Line yAxisId="right" type="monotone" dataKey="views" stroke="#a1a1aa" strokeWidth={2} name="Avg Views (K)" dot={{ r: 4, fill: '#a1a1aa' }} activeDot={{ r: 6, fill: '#a1a1aa' }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="viewed" className="mt-6">
        <TabsList className="bg-neutral-800/50 border border-neutral-700/50 p-1 h-auto">
          <TabsTrigger value="viewed" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Viewed Trends</TabsTrigger>
          <TabsTrigger value="alerts" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Alert History</TabsTrigger>
        </TabsList>

        <TabsContent value="viewed" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-white">Recently Viewed</h3>
            <Button variant="outline" size="sm" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
          
          <div className="space-y-4">
            {viewedTrends.map((trend) => (
              <TrendCard key={trend.id} trend={trend} />
            ))}
          </div>
          
          <div className="flex justify-center mt-6">
            <Button variant="outline" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
              Load More
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-white">Alert Activity</h3>
            <Button variant="outline" size="sm" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
          
          <div className="space-y-4">
            {alertHistory.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
          
          <div className="flex justify-center mt-6">
            <Button variant="outline" className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
              Load More
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
