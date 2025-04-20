import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Save, UserCog, Bell, Globe, Youtube, Monitor, Sun, Moon, Laptop } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function Preferences() {
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("english");
  const [notifyTrending, setNotifyTrending] = useState(true);
  const [notifyAlerts, setNotifyAlerts] = useState(true);
  const [relevanceThreshold, setRelevanceThreshold] = useState([70]);
  const [autoplay, setAutoplay] = useState(true);
  const [defaultView, setDefaultView] = useState("grid");
  
  const handleSavePreferences = () => {
    toast("Preferences saved successfully", {
      description: "Your preferences have been updated.",
      action: {
        label: "Dismiss",
        onClick: () => console.log("Dismissed toast"),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Preferences</h1>
          <p className="text-muted-foreground">
            Customize your experience with Trendy
          </p>
        </div>
        <Button onClick={handleSavePreferences}>
          <Save className="h-4 w-4 mr-2" />
          Save Preferences
        </Button>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how Trendy looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="flex flex-wrap gap-4 pt-2">
                  <div 
                    className={`flex flex-col items-center gap-2 cursor-pointer border rounded-lg p-4 transition-all ${theme === 'light' ? 'border-primary bg-accent/10' : 'border-border hover:border-input'}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-6 w-6" />
                    <span className="text-sm">Light</span>
                  </div>
                  <div 
                    className={`flex flex-col items-center gap-2 cursor-pointer border rounded-lg p-4 transition-all ${theme === 'dark' ? 'border-primary bg-accent/10' : 'border-border hover:border-input'}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-6 w-6" />
                    <span className="text-sm">Dark</span>
                  </div>
                  <div 
                    className={`flex flex-col items-center gap-2 cursor-pointer border rounded-lg p-4 transition-all ${theme === 'system' ? 'border-primary bg-accent/10' : 'border-border hover:border-input'}`}
                    onClick={() => setTheme('system')}
                  >
                    <Laptop className="h-6 w-6" />
                    <span className="text-sm">System</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="french">French</SelectItem>
                    <SelectItem value="german">German</SelectItem>
                    <SelectItem value="japanese">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Manage what notifications you receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="notify-trending" className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-primary" />
                    <div className="space-y-1">
                      <span>Trending updates</span>
                      <p className="text-sm font-normal text-muted-foreground">Get notified about new trending shorts.</p>
                    </div>
                  </Label>
                  <Switch id="notify-trending" checked={notifyTrending} onCheckedChange={setNotifyTrending} />
                </div>

                <Separator />

                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="notify-alerts" className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <div className="space-y-1">
                      <span>Custom alerts</span>
                      <p className="text-sm font-normal text-muted-foreground">Get notified when your alert conditions are met.</p>
                    </div>
                  </Label>
                  <Switch id="notify-alerts" checked={notifyAlerts} onCheckedChange={setNotifyAlerts} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                Content Display
              </CardTitle>
              <CardDescription>
                Configure how content is displayed and filtered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Relevance Threshold</Label>
                  <span className="text-sm font-medium">{relevanceThreshold}%</span>
                </div>
                <Slider
                  value={relevanceThreshold}
                  onValueChange={setRelevanceThreshold}
                  max={100}
                  step={5}
                  className="py-2"
                />
                <p className="text-sm text-muted-foreground">Only show trends with relevance score above this threshold.</p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Default View</Label>
                <RadioGroup value={defaultView} onValueChange={setDefaultView} className="flex gap-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="grid" id="view-grid" />
                    <Label htmlFor="view-grid">Grid</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="list" id="view-list" />
                    <Label htmlFor="view-list">List</Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="autoplay-switch" className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-primary" />
                  <div className="space-y-1">
                    <span>Autoplay Videos</span>
                    <p className="text-sm font-normal text-muted-foreground">Automatically play videos when scrolling.</p>
                  </div>
                </Label>
                <Switch id="autoplay-switch" checked={autoplay} onCheckedChange={setAutoplay} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
