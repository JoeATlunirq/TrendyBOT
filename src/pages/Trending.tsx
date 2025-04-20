import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowUpRight, ChevronUp, Clock, ExternalLink, Filter, Search, Share2, TrendingUp, Users, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { Separator } from "@/components/ui/separator";

// Sample video data
const trendingVideos = [
  {
    id: 1,
    title: "NEW iPhone 15 Pro Unboxing Experience!",
    channel: "TechReviewPro",
    channelSubs: "2.5M",
    views: 450000,
    viewsGrowth: 320,
    likesGrowth: 42,
    commentsGrowth: 38,
    time: "10 minutes ago",
    minutesLive: 45,
    thumbnail: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=techreview",
    category: "Tech"
  },
  {
    id: 2,
    title: "Make $1000 FAST with This Side Hustle!",
    channel: "Money Mentor",
    channelSubs: "1.8M",
    views: 285000,
    viewsGrowth: 220,
    likesGrowth: 35,
    commentsGrowth: 32,
    time: "35 minutes ago",
    minutesLive: 110,
    thumbnail: "https://images.unsplash.com/photo-1579621970588-a35d0e7ab9b6?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=moneymentor",
    category: "Finance"
  },
  {
    id: 3,
    title: "5 Minute Ab Workout That ACTUALLY Works",
    channel: "FitLifeGuru",
    channelSubs: "3.2M",
    views: 195000,
    viewsGrowth: 180,
    likesGrowth: 28,
    commentsGrowth: 25,
    time: "1 hour ago",
    minutesLive: 180,
    thumbnail: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=fitlife",
    category: "Fitness"
  },
  {
    id: 4,
    title: "Easy Delicious 1-Minute Breakfast Hack",
    channel: "ChefCooksPro",
    channelSubs: "1.5M",
    views: 320000,
    viewsGrowth: 250,
    likesGrowth: 38,
    commentsGrowth: 30,
    time: "2 hours ago",
    minutesLive: 240,
    thumbnail: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=chefcooks",
    category: "Food"
  },
  {
    id: 5,
    title: "I Tried the Viral TikTok Beauty Hack...",
    channel: "BeautyGuru",
    channelSubs: "4.7M",
    views: 520000,
    viewsGrowth: 290,
    likesGrowth: 45,
    commentsGrowth: 50,
    time: "3 hours ago",
    minutesLive: 320,
    thumbnail: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=beautyguru",
    category: "Beauty"
  },
  {
    id: 6,
    title: "This Is Why Your Houseplants Are Dying",
    channel: "PlantMaster",
    channelSubs: "980K",
    views: 175000,
    viewsGrowth: 160,
    likesGrowth: 25,
    commentsGrowth: 22,
    time: "4 hours ago",
    minutesLive: 380,
    thumbnail: "https://images.unsplash.com/photo-1545239705-1564e58b9e4a?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
    channelIcon: "https://i.pravatar.cc/150?u=plantmaster",
    category: "Home"
  }
];

const categories = [
  "All",
  "Tech",
  "Finance",
  "Fitness",
  "Food",
  "Beauty",
  "Home",
  "Gaming",
  "Education"
];

const Trending = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState("growth");

  const toggleCategory = (category: string) => {
    if (category === "All") {
      setSelectedCategories([]);
      return;
    }
    
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  // Filter videos based on search and categories
  const filteredVideos = trendingVideos.filter(video => {
    const matchesSearch = 
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.channel.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategories.length === 0 || 
      selectedCategories.includes(video.category);
    
    return matchesSearch && matchesCategory;
  });

  // Sort videos based on selected option
  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (sortOption === "growth") {
      return b.viewsGrowth - a.viewsGrowth;
    } else if (sortOption === "views") {
      return b.views - a.views;
    } else if (sortOption === "engagement") {
      return (b.likesGrowth + b.commentsGrowth) - (a.likesGrowth + a.commentsGrowth);
    }
    return 0;
  });

  return (
    <div className="space-y-6 text-neutral-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-orbitron">Trending Shorts</h1>
          <p className="text-neutral-400">
            Discover YouTube Shorts videos gaining rapid popularity
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-[180px] bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
              <SelectItem value="growth" className="focus:bg-neutral-700 focus:text-white">Highest Growth Rate</SelectItem>
              <SelectItem value="views" className="focus:bg-neutral-700 focus:text-white">Most Views</SelectItem>
              <SelectItem value="engagement" className="focus:bg-neutral-700 focus:text-white">Best Engagement</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold">
            <TrendingUp className="h-4 w-4 mr-2" />
            Create Alert
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
              <Input
                placeholder="Search videos or channels"
                className="pl-9 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400 whitespace-nowrap">Filter by:</span>
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 5).map((category) => (
                  <Badge
                    key={category}
                    variant={selectedCategories.includes(category) || (category === "All" && selectedCategories.length === 0) ? "default" : "secondary"}
                    className={`cursor-pointer transition-opacity hover:opacity-90 ${selectedCategories.includes(category) || (category === "All" && selectedCategories.length === 0) ? 'bg-trendy-yellow text-trendy-brown border-trendy-yellow' : 'bg-neutral-700/60 border-neutral-600 text-neutral-300 hover:bg-neutral-600/80'}`}
                    onClick={() => toggleCategory(category)}
                  >
                    {category}
                  </Badge>
                ))}
                <Badge variant="secondary" className="cursor-pointer bg-neutral-700/60 border-neutral-600 text-neutral-300 hover:bg-neutral-600/80">
                  More...
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trending Videos Grid */}
      <Tabs defaultValue="grid">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-neutral-400">
            Showing {sortedVideos.length} trending videos
          </p>
          <TabsList className="bg-neutral-800/50 border border-neutral-700/50 p-1 h-auto">
            <TabsTrigger value="grid" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Grid</TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">List</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grid" className="mt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedVideos.map((video) => (
              <Card key={video.id} className="overflow-hidden flex flex-col h-full bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg text-neutral-200">
                <div className="relative">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title} 
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-black/70 hover:bg-black/70 flex items-center text-white border-none">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {video.viewsGrowth}% growth
                    </Badge>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="secondary" className="bg-neutral-700/60 border-neutral-600 text-neutral-300">
                      {video.category}
                    </Badge>
                  </div>
                </div>
                <CardContent className="py-4 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <Avatar className="w-9 h-9 rounded-full">
                      <AvatarImage src={video.channelIcon} />
                      <AvatarFallback className="bg-neutral-600 text-neutral-300">{video.channel[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium line-clamp-2 mb-1 text-white">{video.title}</h3>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-neutral-400">{video.channel}</span>
                        <span className="h-1 w-1 rounded-full bg-neutral-500 inline-block mx-1"></span>
                        <span className="text-xs text-neutral-400 flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {video.channelSubs}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-neutral-700/60 border border-neutral-600 rounded p-2 text-center">
                      <div className="text-sm font-medium text-white">{(video.views / 1000).toFixed(0)}k</div>
                      <div className="text-xs text-neutral-400">Views</div>
                    </div>
                    <div className="bg-neutral-700/60 border border-neutral-600 rounded p-2 text-center">
                      <div className="text-sm font-medium flex items-center justify-center text-white">
                        {video.likesGrowth}%
                        <ChevronUp className="h-3 w-3 text-green-400 ml-1" />
                      </div>
                      <div className="text-xs text-neutral-400">Likes</div>
                    </div>
                    <div className="bg-neutral-700/60 border border-neutral-600 rounded p-2 text-center">
                      <div className="text-sm font-medium text-white">{video.minutesLive}m</div>
                      <div className="text-xs text-neutral-400">Age</div>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="text-xs text-neutral-500 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {video.time}
                    </div>
                    <Button size="sm" variant="outline" asChild className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                      <Link to={`/trending/${video.id}`}>
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
                {sortedVideos.map((video) => (
                  <div 
                    key={video.id} 
                    className="flex flex-col sm:flex-row gap-4 p-4 border border-neutral-700/80 rounded-lg hover:bg-neutral-700/40 transition-colors"
                  >
                    <div className="sm:w-48 md:w-60 flex-shrink-0 relative">
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full aspect-video object-cover rounded-md"
                      />
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        <TrendingUp className="h-3 w-3 inline mr-1" />
                        {video.viewsGrowth}%
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium line-clamp-2 text-white">{video.title}</h3>
                        <Badge variant="secondary" className="whitespace-nowrap flex-shrink-0 bg-neutral-700/60 border-neutral-600 text-neutral-300">
                          {video.category}
                        </Badge>
                      </div>
                      <div className="flex items-center mt-2 gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={video.channelIcon} />
                          <AvatarFallback>{video.channel[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-neutral-400">{video.channel}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">
                          {video.channelSubs}
                        </span>
                      </div>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3">
                        <span className="text-sm text-neutral-400 flex items-center">
                          <Youtube className="h-3.5 w-3.5 mr-1" />
                          {(video.views / 1000).toFixed(0)}K views
                        </span>
                        <span className="text-sm text-neutral-400 flex items-center">
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          {video.time}
                        </span>
                        <span className="text-sm text-green-400 flex items-center">
                          <TrendingUp className="h-3.5 w-3.5 mr-1" />
                          {video.likesGrowth}% engagement
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="w-full max-w-[200px]">
                          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                            <span>Growth Rate</span>
                            <span>{video.viewsGrowth}%</span>
                          </div>
                          <Progress value={video.viewsGrowth > 300 ? 100 : (video.viewsGrowth / 3)} className="h-2 bg-neutral-700 [&>div]:bg-trendy-yellow" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="ghost" className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50">
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-neutral-400 hover:text-trendy-yellow hover:bg-neutral-700/50">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" asChild className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white">
                            <Link to={`/trending/${video.id}`}>
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
