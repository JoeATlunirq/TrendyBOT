import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BellRing, Check, MessageSquare, SendHorizontal, Bot, Settings, ExternalLink } from "lucide-react";

export default function GetNotified() {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);
  const [emailConnected, setEmailConnected] = useState(true);
  
  const [telegramUsername, setTelegramUsername] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [emailAddress, setEmailAddress] = useState("you@example.com");
  
  const handleTelegramConnect = () => {
    if (!telegramUsername.trim()) {
      toast.error("Please enter your Telegram username");
      return;
    }
    
    // Simulate connection process
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Connecting to Telegram...",
        success: () => {
          setTelegramConnected(true);
          return "Connected to Telegram successfully!";
        },
        error: "Failed to connect to Telegram",
      }
    );
  };

  const handleDiscordConnect = () => {
    if (!discordWebhook.trim()) {
      toast.error("Please enter your Discord webhook URL");
      return;
    }
    
    // Simulate connection process
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "Connecting to Discord...",
        success: () => {
          setDiscordConnected(true);
          return "Connected to Discord successfully!";
        },
        error: "Failed to connect to Discord",
      }
    );
  };

  const handleSendTestNotification = (platform: string) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: `Sending test notification to ${platform}...`,
        success: `Test notification sent to ${platform}!`,
        error: `Failed to send test notification to ${platform}`,
      }
    );
  };

  return (
    <div className="container py-6 space-y-8 max-w-5xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Get Notified</h1>
        <p className="text-muted-foreground">
          Configure how and where you want to receive trend alerts.
        </p>
      </div>

      <Tabs defaultValue="channels" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="channels">Notification Channels</TabsTrigger>
          <TabsTrigger value="preferences">Delivery Preferences</TabsTrigger>
          <TabsTrigger value="templates">Alert Templates</TabsTrigger>
        </TabsList>
        
        <TabsContent value="channels" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Telegram Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ExternalLink className="h-5 w-5 text-primary" />
                    Telegram
                  </CardTitle>
                  {telegramConnected && (
                    <div className="flex items-center text-xs text-green-500 gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Connected
                    </div>
                  )}
                </div>
                <CardDescription>
                  Get instant notifications via Telegram
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="telegram-username">Telegram Username</Label>
                    <Input 
                      id="telegram-username"
                      placeholder="@yourusername"
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    First, message our bot @TrendyAlertsBot on Telegram to start the connection.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {telegramConnected ? (
                  <>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleSendTestNotification("Telegram")}
                    >
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      Send Test Notification
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="secondary"
                      onClick={() => setTelegramConnected(false)}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button 
                    className="w-full trendy-button"
                    onClick={handleTelegramConnect}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Connect to Telegram
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Discord Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Discord
                  </CardTitle>
                  {discordConnected && (
                    <div className="flex items-center text-xs text-green-500 gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Connected
                    </div>
                  )}
                </div>
                <CardDescription>
                  Receive alerts in your Discord server
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="discord-webhook">Discord Webhook URL</Label>
                    <Input 
                      id="discord-webhook"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={discordWebhook}
                      onChange={(e) => setDiscordWebhook(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Create a webhook in your Discord server settings and paste the URL here.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {discordConnected ? (
                  <>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleSendTestNotification("Discord")}
                    >
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      Send Test Notification
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="secondary"
                      onClick={() => setDiscordConnected(false)}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button 
                    className="w-full trendy-button"
                    onClick={handleDiscordConnect}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Connect to Discord
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Email Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    Email
                  </CardTitle>
                  {emailConnected && (
                    <div className="flex items-center text-xs text-green-500 gap-1">
                      <Check className="h-3.5 w-3.5" />
                      Connected
                    </div>
                  )}
                </div>
                <CardDescription>
                  Get daily or weekly email alerts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="email-address">Email Address</Label>
                    <Input 
                      id="email-address"
                      type="email"
                      placeholder="you@example.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    We'll send trend alerts and weekly digests to this email address.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                {emailConnected ? (
                  <>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleSendTestNotification("Email")}
                    >
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      Send Test Email
                    </Button>
                    <Button 
                      className="w-full" 
                      variant="secondary"
                      onClick={() => setEmailConnected(false)}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button 
                    className="w-full trendy-button"
                    onClick={() => setEmailConnected(true)}
                  >
                    Connect Email
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="preferences" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure when and how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Frequency</h3>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="instant-alerts" className="flex flex-col gap-1">
                      <span>Instant Alerts</span>
                      <span className="font-normal text-sm text-muted-foreground">Notify me as soon as a video starts trending</span>
                    </Label>
                    <Switch id="instant-alerts" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="daily-digest" className="flex flex-col gap-1">
                      <span>Daily Digest</span>
                      <span className="font-normal text-sm text-muted-foreground">Receive a summary of all trending videos daily</span>
                    </Label>
                    <Switch id="daily-digest" />
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="weekly-report" className="flex flex-col gap-1">
                      <span>Weekly Report</span>
                      <span className="font-normal text-sm text-muted-foreground">Get a weekly summary of top performing videos</span>
                    </Label>
                    <Switch id="weekly-report" defaultChecked />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Quiet Hours</h3>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="do-not-disturb" className="flex flex-col gap-1">
                      <span>Do Not Disturb</span>
                      <span className="font-normal text-sm text-muted-foreground">Mute notifications during specific hours</span>
                    </Label>
                    <Switch id="do-not-disturb" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Channel Preferences</h3>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="telegram-enabled" className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-primary" />
                      <span>Telegram</span>
                    </Label>
                    <Switch id="telegram-enabled" checked={telegramConnected} disabled={!telegramConnected} />
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="discord-enabled" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span>Discord</span>
                    </Label>
                    <Switch id="discord-enabled" checked={discordConnected} disabled={!discordConnected} />
                  </div>
                  <div className="flex items-center justify-between space-x-2">
                    <Label htmlFor="email-enabled" className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      <span>Email</span>
                    </Label>
                    <Switch id="email-enabled" checked={emailConnected} disabled={!emailConnected} />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline">Reset</Button>
              <Button className="trendy-button">
                <Settings className="mr-2 h-4 w-4" />
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="templates" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Templates</CardTitle>
              <CardDescription>
                Customize how your trend alerts will look
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-telegram">Telegram Template</Label>
                <div className="relative">
                  <div className="absolute top-2 right-2 p-1 text-xs bg-primary text-primary-foreground rounded">Default</div>
                  <textarea 
                    id="template-telegram"
                    className="w-full h-32 p-3 text-sm rounded-md border resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    defaultValue={`🔥 TRENDING: {video_title}\n\n📈 {views} views • {likes} likes • {comments} comments\n\n👤 {channel_name}\n\n🕒 Posted {time_ago}\n\n👉 {video_url}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Available variables: {'{video_title}'}, {'{views}'}, {'{likes}'}, {'{comments}'}, {'{channel_name}'}, {'{time_ago}'}, {'{video_url}'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template-discord">Discord Template</Label>
                <div className="relative">
                  <div className="absolute top-2 right-2 p-1 text-xs bg-primary text-primary-foreground rounded">Default</div>
                  <textarea 
                    id="template-discord"
                    className="w-full h-32 p-3 text-sm rounded-md border resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    defaultValue={`**🔥 TRENDING VIDEO ALERT 🔥**\n\n**{video_title}**\n\n📊 **Stats:**\n• Views: {views}\n• Likes: {likes}\n• Comments: {comments}\n\n👤 **Channel:** {channel_name}\n\n🔗 {video_url}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Discord supports Markdown formatting for rich text
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template-email">Email Template</Label>
                <div className="p-4 border rounded-md bg-card text-card-foreground">
                  <p className="text-sm">Email templates use our standard HTML layout with your customized content. You can configure the email subject and preview text below.</p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="space-y-1">
                      <Label htmlFor="email-subject" className="text-xs">Subject Line</Label>
                      <Input 
                        id="email-subject"
                        defaultValue="🔥 New Trending Shorts Alert from Trendy"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email-preview" className="text-xs">Preview Text</Label>
                      <Input 
                        id="email-preview"
                        defaultValue="A new video is trending: {video_title}"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Button variant="outline">Reset to Default</Button>
              <Button className="trendy-button">Save Templates</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
