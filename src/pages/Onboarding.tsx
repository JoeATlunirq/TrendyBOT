import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Logo } from "@/components/Logo";
import { ArrowRight, Check, Youtube, Loader2, X, PlusCircle } from "lucide-react";

const OnboardingSteps = [
  {
    id: "welcome",
    title: "Welcome to trendy!",
    description: "Let's set up your account to monitor YouTube Shorts trends."
  },
  {
    id: "niche",
    title: "Select your niche",
    description: "What type of content are you most interested in monitoring?"
  },
  {
    id: "notifications",
    title: "Set up notifications",
    description: "How would you like to receive trend alerts?"
  },
  {
    id: "completion",
    title: "You're all set!",
    description: "Your trendy account is ready to go."
  }
];

const niches = [
  { id: "tech", label: "Tech & Gadgets" },
  { id: "fashion", label: "Fashion & Beauty" },
  { id: "fitness", label: "Fitness & Health" },
  { id: "gaming", label: "Gaming" },
  { id: "food", label: "Food & Cooking" },
  { id: "travel", label: "Travel" },
  { id: "education", label: "Education" },
  { id: "entertainment", label: "Entertainment" },
  { id: "business", label: "Business & Finance" },
  { id: "other", label: "Other" }
];

const notificationChannels = [
  { id: "email", label: "Email", icon: "📧" },
  { id: "telegram", label: "Telegram", icon: "📱" },
  { id: "discord", label: "Discord", icon: "💬" }
];

const BACKEND_API_BASE_URL = 'http://localhost:5001/api';

// Define type for tracked channel object
type TrackedChannel = {
    id: string;
    title: string;
    thumbnailUrl?: string;
    subscriberCount?: number;
}

// --- Helper Functions ---
const isValidEmail = (email: string): boolean => {
  // Basic email regex (adjust for stricter validation if needed)
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
};

const isValidDiscordWebhook = (url: string): boolean => {
    return typeof url === 'string' && url.startsWith('https://discord.com/api/webhooks/');
};
// -----------------------

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [channelInputs, setChannelInputs] = useState<Record<string, string>>({
    email: "",
    telegram: "",
    discord: ""
  });
  const [channelInput, setChannelInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<TrackedChannel | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [trackedChannels, setTrackedChannels] = useState<TrackedChannel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleNext = async () => {
    // --- Validation --- 
    if (currentStep === 1 && !selectedNiche) {
      toast({
        title: "Please select a niche",
        description: "You need to select at least one niche to continue.",
        variant: "destructive"
      });
      return;
    }

    if (currentStep === 2) {
        // Validate notification inputs ONLY if channels are selected
        if (selectedChannels.length === 0) {
             toast({ title: "Please select a notification channel", description: "You need to select at least one way to receive alerts.", variant: "destructive" });
             return;
        }
        
        let notificationInputValid = true;
        for (const channelId of selectedChannels) {
            const inputValue = channelInputs[channelId]?.trim() || "";
            
            if (!inputValue) {
                toast({ title: "Input Required", description: `Please enter your details for the selected ${channelId} channel.`, variant: "destructive" });
                notificationInputValid = false;
                break; // Stop validation on first error
            }
            
            if (channelId === 'email' && !isValidEmail(inputValue)) {
                 toast({ title: "Invalid Email", description: `Please enter a valid email address for notifications.`, variant: "destructive" });
                 notificationInputValid = false;
                 break;
            }

            if (channelId === 'discord' && !isValidDiscordWebhook(inputValue)) {
                 toast({ title: "Invalid Discord Webhook", description: `Please enter a valid Discord webhook URL (starting with https://discord.com/api/webhooks/).`, variant: "destructive" });
                 notificationInputValid = false;
                 break;
            }
            
            // Telegram validation is just checking if it's not empty (already done above)
        }

        if (!notificationInputValid) {
            return; // Don't proceed if any input for selected channels is invalid
        }
    }
    // --- End Validation ---

    if (currentStep === OnboardingSteps.length - 1) {
      if (!token) {
        toast({ title: "Authentication Error", description: "Cannot save preferences. Please log in again.", variant: "destructive" });
        navigate('/login');
        return;
      }
      setIsSaving(true);
      try {
        const preferencesData = {
          niche: selectedNiche,
          selectedChannels: selectedChannels,
          channelInputs: channelInputs,
          trackedChannelIds: trackedChannels.map(ch => ch.id),
        };

        const response = await axios.put(
          `${BACKEND_API_BASE_URL}/users/preferences`, 
          preferencesData,
          {
            headers: { 
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.data?.user) {
            localStorage.setItem('trendy_user', JSON.stringify(response.data.user));
        }

        toast({ title: "Preferences Saved!", description: "Redirecting to dashboard..." });
        navigate("/dashboard");

      } catch (error: any) {
        console.error("Failed to save onboarding preferences:", error);
        const message = error.response?.data?.message || "Failed to save preferences. Please try again.";
        toast({ title: "Error Saving Preferences", description: message, variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setCurrentStep((prev) => prev + 1);
  };

  const handleChannelToggle = (channelId: string, checked: boolean) => {
    if (checked) {
      setSelectedChannels((prev) => [...prev, channelId]);
    } else {
      setSelectedChannels((prev) => prev.filter((id) => id !== channelId));
    }
  };

  const handleChannelInput = (channelId: string, value: string) => {
    setChannelInputs((prev) => ({
      ...prev,
      [channelId]: value
    }));
  };

  // --- YouTube Channel Handlers ---
  const handleChannelLookup = async () => {
      const query = channelInput.trim();
      if (!query) {
          toast({ title: "Please enter a channel name, ID, or URL", variant: "destructive" });
          return;
      }
      if (!token) {
          toast({ title: "Authentication Error", description: "Cannot perform lookup. Please log in again.", variant: "destructive" });
          return;
      }

      setLookupLoading(true);
      setLookupError(null);
      setLookupResult(null);

      try {
          const response = await axios.post(
              `${BACKEND_API_BASE_URL}/youtube/lookup`,
              { query },
              { headers: { 'Authorization': `Bearer ${token}` }}
          );
          setLookupResult(response.data);
          setChannelInput("");

      } catch (error: any) {
          console.error("Channel lookup error:", error);
          const message = error.response?.data?.message || "Channel lookup failed.";
          setLookupError(message);
          toast({ title: "Lookup Failed", description: message, variant: "destructive" });
      } finally {
          setLookupLoading(false);
      }
  };

  const handleConfirmAddChannel = () => {
      if (!lookupResult) return;
      
      if (trackedChannels.some(ch => ch.id === lookupResult.id)) {
          toast({ title: "Channel already added", variant: "default" });
          setLookupResult(null);
          return;
      }

      setTrackedChannels(prev => [...prev, lookupResult]);
      setLookupResult(null);
      setLookupError(null);
  };

  const handleRemoveChannel = (channelIdToRemove: string) => {
    setTrackedChannels(prev => prev.filter(channel => channel.id !== channelIdToRemove));
  };
  // --------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-trendy-brown text-neutral-200">
      <header className="sticky top-0 z-40 border-b border-neutral-700/50 bg-trendy-brown/80 backdrop-blur-md py-4 px-6">
        <div className="container mx-auto flex justify-between items-center">
          <Logo className="h-8 w-auto text-trendy-yellow" />
          <div className="flex items-center gap-1.5">
            {OnboardingSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-8 rounded-full transition-colors ${ 
                  index <= currentStep ? "bg-trendy-yellow" : "bg-neutral-700"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto py-8 px-4 md:py-12 md:px-6 max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-orbitron font-bold mb-2 text-white">
            {OnboardingSteps[currentStep].title}
          </h1>
          <p className="text-neutral-400">
            {OnboardingSteps[currentStep].description}
          </p>
        </div>

        <div className="space-y-6">
          {currentStep === 0 && (
            <Card className="animate-fade-in bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
              <CardContent className="pt-6 flex flex-col items-center text-center px-4 py-12">
                <div className="w-24 h-24 mb-6 yellow-glow">
                  <img src="/lovable-uploads/c7a870cf-9a80-4a17-959e-ccd42ccda497.png" alt="trendy Logo" className="w-full h-full object-contain" />
                </div>
                <h2 className="text-2xl font-semibold mb-4 text-white">Discover Trending YouTube Shorts First</h2>
                <p className="text-neutral-400 mb-8 max-w-md">
                  trendy monitors YouTube Shorts in real-time to alert you about 
                  viral videos before they peak. Get ahead of trends and boost your content strategy.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl mb-8">
                  <div className="bg-neutral-700/60 p-4 rounded-lg border border-neutral-600 flex flex-col items-center">
                    <div className="text-4xl mb-2">🔍</div>
                    <h3 className="font-medium text-white mb-1">Real-time Monitoring</h3>
                    <p className="text-sm text-neutral-400">Track trending videos as they gain momentum</p>
                  </div>
                  <div className="bg-neutral-700/60 p-4 rounded-lg border border-neutral-600 flex flex-col items-center">
                    <div className="text-4xl mb-2">⚡</div>
                    <h3 className="font-medium text-white mb-1">Instant Alerts</h3>
                    <p className="text-sm text-neutral-400">Get notified when videos start going viral</p>
                  </div>
                  <div className="bg-neutral-700/60 p-4 rounded-lg border border-neutral-600 flex flex-col items-center">
                    <div className="text-4xl mb-2">📊</div>
                    <h3 className="font-medium text-white mb-1">Trend Analysis</h3>
                    <p className="text-sm text-neutral-400">Understand what makes content successful</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            <Card className="animate-fade-in bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 py-4">
                  {niches.map((niche) => (
                    <div
                      key={niche.id}
                      className={`border rounded-md p-4 cursor-pointer transition-all ${ 
                        selectedNiche === niche.id
                          ? "border-trendy-yellow bg-trendy-yellow/10 ring-1 ring-trendy-yellow"
                          : "border-neutral-600 hover:border-neutral-500 bg-neutral-700/30 hover:bg-neutral-700/50"
                      }`}
                      onClick={() => setSelectedNiche(niche.id)}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-medium text-neutral-100">{niche.label}</span>
                        {selectedNiche === niche.id && (
                          <Check className="h-5 w-5 text-trendy-yellow" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="channels-input" className="text-neutral-300">YouTube Channels to Track (Optional)</Label>
                    <div className="flex gap-2 mt-2">
                      <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500">
                          <Youtube className="h-4 w-4" />
                        </div>
                        <Input
                          id="channels-input"
                          placeholder="Enter channel name, ID, or URL to lookup"
                          className="pl-9 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                          value={channelInput}
                          onChange={(e) => setChannelInput(e.target.value)}
                        />
                      </div>
                      <Button 
                        variant="outline" 
                        type="button" 
                        className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white disabled:opacity-50"
                        onClick={handleChannelLookup}
                        disabled={lookupLoading || !channelInput.trim()}
                      >
                        {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lookup'}
                      </Button>
                    </div>
                  </div>

                  {lookupError && (
                       <p className="text-sm text-red-400">Error: {lookupError}</p>
                  )}
                  {lookupResult && (
                      <div className="p-3 bg-neutral-700/50 border border-neutral-600 rounded-md flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                              <img src={lookupResult.thumbnailUrl || 'https://via.placeholder.com/40?text=?'} alt="Channel Thumbnail" className="w-10 h-10 rounded-full bg-neutral-600 flex-shrink-0" />
                              <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">{lookupResult.title}</p>
                                  {lookupResult.subscriberCount !== undefined && (
                                      <p className="text-xs text-neutral-400">{lookupResult.subscriberCount.toLocaleString()} subscribers</p>
                                  )}
                              </div>
                          </div>
                          <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={handleConfirmAddChannel}
                              className="text-trendy-yellow hover:bg-trendy-yellow/10 hover:text-trendy-yellow flex-shrink-0"
                          >
                              <PlusCircle className="h-4 w-4 mr-1" /> Add to List
                          </Button>
                      </div>
                  )}

                  {trackedChannels.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-neutral-400">Tracking Channels:</p>
                      <ul className="space-y-2">
                        {trackedChannels.map((channel) => (
                          <li key={channel.id} className="flex items-center justify-between gap-2 bg-neutral-700/80 text-neutral-200 px-3 py-2 rounded-md border border-neutral-600">
                              <div className="flex items-center gap-2 min-w-0">
                                 <img src={channel.thumbnailUrl || 'https://via.placeholder.com/24?text=?'} alt="Channel Thumbnail" className="w-6 h-6 rounded-full bg-neutral-600 flex-shrink-0" /> 
                                 <span className="text-sm truncate flex-1">{channel.title}</span>
                              </div>
                            <button 
                              onClick={() => handleRemoveChannel(channel.id)} 
                              className="text-neutral-500 hover:text-red-400 transition-colors flex-shrink-0"
                              aria-label={`Remove ${channel.title}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="animate-fade-in bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-4">
                  {notificationChannels.map((channel) => (
                    <div key={channel.id} className="border border-neutral-600 bg-neutral-700/30 rounded-md p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <Checkbox 
                          id={`channel-${channel.id}`} 
                          checked={selectedChannels.includes(channel.id)}
                          onCheckedChange={(checked) => 
                            handleChannelToggle(channel.id, checked as boolean)
                          }
                          className="border-neutral-500 data-[state=checked]:bg-trendy-yellow data-[state=checked]:text-trendy-brown focus-visible:ring-trendy-yellow"
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`channel-${channel.id}`}
                            className="text-base font-medium cursor-pointer text-neutral-100"
                          >
                            <span className="mr-2">{channel.icon}</span>
                            {channel.label}
                          </Label>
                          <p className="text-sm text-neutral-400 mt-1">
                            {channel.id === "email" && "Receive trend alerts directly in your inbox"}
                            {channel.id === "telegram" && "Get instant notifications in your Telegram app"}
                            {channel.id === "discord" && "Receive alerts in your Discord server"}
                          </p>
                        </div>
                      </div>
                      {selectedChannels.includes(channel.id) && (
                        <div className="pl-7">
                          <Input
                            id={`input-${channel.id}`}
                            placeholder={
                              channel.id === "email" ? "your@email.com" :
                              channel.id === "telegram" ? "Your Telegram username or phone" :
                              "Discord webhook URL"
                            }
                            value={channelInputs[channel.id]}
                            onChange={(e) => handleChannelInput(channel.id, e.target.value)}
                            className="max-w-md bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <h3 className="font-medium mb-3 text-white">Notification Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox id="pref-immediate" defaultChecked className="border-neutral-500 data-[state=checked]:bg-trendy-yellow data-[state=checked]:text-trendy-brown focus-visible:ring-trendy-yellow"/>
                      <Label htmlFor="pref-immediate" className="text-neutral-300">Send immediate alerts for trending videos</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="pref-daily" className="border-neutral-500 data-[state=checked]:bg-trendy-yellow data-[state=checked]:text-trendy-brown focus-visible:ring-trendy-yellow"/>
                      <Label htmlFor="pref-daily" className="text-neutral-300">Send daily digest of trending content</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox id="pref-weekly" className="border-neutral-500 data-[state=checked]:bg-trendy-yellow data-[state=checked]:text-trendy-brown focus-visible:ring-trendy-yellow"/>
                      <Label htmlFor="pref-weekly" className="text-neutral-300">Send weekly summary of top trends</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="animate-fade-in bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg">
              <CardContent className="pt-6 flex flex-col items-center text-center p-12">
                <div className="w-20 h-20 bg-trendy-yellow/20 rounded-full flex items-center justify-center mb-6 border border-trendy-yellow/50">
                  <Check className="h-10 w-10 text-trendy-yellow" />
                </div>
                <h2 className="text-2xl font-semibold mb-2 text-white">You're ready to go!</h2>
                <p className="text-neutral-400 mb-8 max-w-md">
                  Your trendy account is now set up and ready to start monitoring YouTube Shorts trends.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-8">
                  <div className="bg-neutral-700/60 p-4 rounded-lg border border-neutral-600 text-left">
                    <h3 className="font-medium text-white mb-2">Selected Niche</h3>
                    <p className="text-sm text-neutral-300">
                      {niches.find(n => n.id === selectedNiche)?.label || "General"}
                    </p>
                  </div>
                  <div className="bg-neutral-700/60 p-4 rounded-lg border border-neutral-600 text-left">
                    <h3 className="font-medium text-white mb-2">Notification Channels</h3>
                    <p className="text-sm text-neutral-300">
                      {selectedChannels.length === 0 
                        ? "None selected" 
                        : selectedChannels
                            .map(id => notificationChannels.find(c => c.id === id)?.label)
                            .join(", ")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <Button 
            onClick={handleNext} 
            size="lg" 
            className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-semibold disabled:opacity-70"
            disabled={isSaving}
          >
            {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
            ) : currentStep === OnboardingSteps.length - 1 ? (
              "Go to Dashboard"
            ) : (
              <>
                Next Step <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Onboarding;
