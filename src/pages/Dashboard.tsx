import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowUpRight, Bell, ChevronDown, ChevronUp, Clock, Filter, Info, MoreHorizontal, TrendingUp, Youtube } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

// Define sample data for different dashboard sections
const alertsData = [
  {
    id: 1,
    title: "NEW iPhone 15 Pro Unboxing Experience!",
    channel: "TechReviewPro",
    views: 450000,
    viewsGrowth: 320,
    likes: 42000,
    time: "10 minutes ago",
    thumbnail: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=techreview",
    category: "Tech"
  },
  {
    id: 2,
    title: "Make $1000 FAST with This Side Hustle!",
    channel: "Money Mentor",
    views: 285000,
    viewsGrowth: 220,
    likes: 35000,
    time: "35 minutes ago",
    thumbnail: "https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=moneymentor",
    category: "Finance"
  },
  {
    id: 3,
    title: "5 Minute Ab Workout That ACTUALLY Works",
    channel: "FitLifeGuru",
    views: 195000,
    viewsGrowth: 180,
    likes: 28000,
    time: "1 hour ago",
    thumbnail: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=fitlife",
    category: "Fitness"
  }
];

const statsData = [
  {
    label: "Alerts Today",
    value: 18,
    change: 5,
    changeType: "increase"
  },
  {
    label: "Total Tracked",
    value: 324,
    change: 12,
    changeType: "increase"
  },
  {
    label: "Avg. Response Time",
    value: "1.2s",
    change: 0.3,
    changeType: "decrease"
  },
  {
    label: "Notification Success",
    value: "99.8%",
    change: 0.2,
    changeType: "increase"
  }
];

const topChannelsData = [
  { name: "TechReviewPro", count: 42, growth: 8 },
  { name: "Money Mentor", count: 35, growth: 12 },
  { name: "FitLifeGuru", count: 29, growth: 5 }
];

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor trending YouTube Shorts and receive real-time alerts.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
          <Button className="bg-trendy-purple hover:bg-trendy-purple/90">
            <Bell className="h-4 w-4 mr-2" />
            Manage Alerts
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex flex-col space-y-1.5">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold">{stat.value}</span>
                  <div className={`flex items-center ${
                    stat.changeType === "increase" ? "text-green-500" : "text-red-500"
                  }`}>
                    {stat.changeType === "increase" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="text-sm font-medium">{stat.change}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Section - Takes 2/3 of the space on large screens */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Alerts</CardTitle>
                  <CardDescription>Trending videos detected in the last 24 hours</CardDescription>
                </div>
                <Tabs defaultValue="all">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="tech">Tech</TabsTrigger>
                    <TabsTrigger value="finance">Finance</TabsTrigger>
                    <TabsTrigger value="fitness">Fitness</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {alertsData.map((alert) => (
                <div 
                  key={alert.id}
                  className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg hover:bg-accent/10 transition-colors"
                >
                  <div className="sm:w-32 md:w-40 flex-shrink-0 relative">
                    <img 
                      src={alert.thumbnail} 
                      alt={alert.title}
                      className="w-full aspect-video object-cover rounded-md"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      <TrendingUp className="h-3 w-3 inline mr-1" />
                      {alert.viewsGrowth}%
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium line-clamp-2">{alert.title}</h3>
                        <Badge variant="outline" className="whitespace-nowrap flex-shrink-0">
                          {alert.category}
                        </Badge>
                      </div>
                      <div className="flex items-center mt-2 gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={alert.channelIcon} />
                          <AvatarFallback>{alert.channel[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">{alert.channel}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-muted-foreground flex items-center">
                          <Youtube className="h-3.5 w-3.5 mr-1" />
                          {(alert.views / 1000).toFixed(0)}K views
                        </span>
                        <span className="text-sm text-muted-foreground flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          {alert.time}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="w-full max-w-[140px]">
                        <div className="text-xs text-muted-foreground mb-1">Growth Rate</div>
                        <Progress value={alert.viewsGrowth > 300 ? 100 : (alert.viewsGrowth / 3)} className="h-2" />
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/trending/${alert.id}`}>
                          <span className="flex items-center">
                            Details
                            <ArrowUpRight className="ml-1 h-3 w-3" />
                          </span>
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex justify-center pb-4">
              <Button variant="ghost" asChild>
                <Link to="/trending">View All Trending Shorts</Link>
              </Button>
            </CardFooter>
          </Card>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Monitoring is active</AlertTitle>
            <AlertDescription>
              Trendy is actively monitoring YouTube Shorts for new trends. Last check was 2 minutes ago.
            </AlertDescription>
          </Alert>
        </div>

        {/* Sidebar Section - Takes 1/3 of the space on large screens */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Trending Channels</CardTitle>
              <CardDescription>Channels with the most alerts this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topChannelsData.map((channel, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={`https://i.pravatar.cc/150?u=${channel.name}`} />
                        <AvatarFallback>{channel.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{channel.name}</div>
                        <div className="text-sm text-muted-foreground">{channel.count} trending videos</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="flex items-center">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {channel.growth}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" className="w-full" asChild>
                <Link to="/analytics">View detailed analytics</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Alert Configuration</CardTitle>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Views Threshold</div>
                  <div className="text-sm">100K in 1h</div>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Engagement Rate</div>
                  <div className="text-sm">15%</div>
                </div>
                <Progress value={60} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Growth Velocity</div>
                  <div className="text-sm">200% / hour</div>
                </div>
                <Progress value={85} className="h-2" />
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-sm font-medium">Active Filters</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Tech
                    <span className="i-lucide-x h-3 w-3 ml-1" />
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Finance
                    <span className="i-lucide-x h-3 w-3 ml-1" />
                  </Badge>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Fitness
                    <span className="i-lucide-x h-3 w-3 ml-1" />
                  </Badge>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-trendy-purple hover:bg-trendy-purple/90" asChild>
                <Link to="/settings">Customize Alert Settings</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
