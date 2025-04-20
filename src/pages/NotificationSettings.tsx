import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, BellRing } from 'lucide-react';

// Get backend URL
const BACKEND_API_BASE_URL = 'http://localhost:5001/api';

// Define type for state
type NotificationSettingsState = {
    telegramChatId: string;
    discordWebhookUrl: string;
    deliveryPreference: string;
    // Add connection status if needed
};

// Column Names (Hardcoded - ensure match backend .env/NocoDB)
const TELEGRAM_ID_COLUMN = 'telegram_chat_id';
const DISCORD_URL_COLUMN = 'discord_webhook_url';
const DELIVERY_PREF_COLUMN = 'delivery_preference';

const NotificationSettings = () => {
    const { user, token } = useAuth();
    const { toast } = useToast();
    const [settings, setSettings] = useState<NotificationSettingsState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch current settings on load
    useEffect(() => {
        const fetchSettings = async () => {
            if (!token) return;
            setIsLoading(true);
            try {
                const response = await axios.get(`${BACKEND_API_BASE_URL}/users/notifications`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                // Map response keys to state keys
                setSettings({
                    telegramChatId: response.data[TELEGRAM_ID_COLUMN] ?? '',
                    discordWebhookUrl: response.data[DISCORD_URL_COLUMN] ?? '',
                    deliveryPreference: response.data[DELIVERY_PREF_COLUMN] ?? 'Instantly',
                });
            } catch (error: any) {
                console.error("Failed to fetch notification settings:", error);
                toast({ title: "Error Loading Settings", description: error.response?.data?.message || error.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [token, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => prev ? { ...prev, [name]: value } : null);
    };
    
    const handleSelectChange = (value: string) => {
         setSettings(prev => prev ? { ...prev, deliveryPreference: value } : null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !settings) return; 
        setIsSaving(true);

        // Validation
        if (settings.discordWebhookUrl && !settings.discordWebhookUrl.startsWith('https://discord.com/api/webhooks/')) {
             toast({ title: "Invalid Discord Webhook", description: "URL must start with https://discord.com/api/webhooks/", variant: "destructive" });
             setIsSaving(false);
             return;
        }

        try {
            const response = await axios.put(
                `${BACKEND_API_BASE_URL}/users/notifications`,
                settings, // Send the state object (keys match controller expectations)
                { headers: { 'Authorization': `Bearer ${token}` }}
            );

            toast({ title: "Settings Saved", description: response.data?.message || "Your preferences have been updated." });
            if (response.data?.user) {
                 localStorage.setItem('trendy_user', JSON.stringify(response.data.user)); 
            }

        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to save settings.";
            toast({ title: "Save Failed", description: message, variant: "destructive" });
            console.error("Notification save error:", error.response?.data || error);
        } finally {
            setIsSaving(false);
        }
    };
    
    // TODO: Handlers for Test/Connect buttons

    if (isLoading) {
        return <div className="container mx-auto py-8 px-4 md:px-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    if (!settings) {
         return <div className="container mx-auto py-8 px-4 md:px-6 text-center text-red-400">Failed to load settings. Please try again later.</div>;
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl">
             <div className="flex justify-between items-center mb-6">
                 <div>
                    <h1 className="text-3xl font-bold text-white font-orbitron">Notification Settings</h1>
                    <p className="text-neutral-400">Manage channels, delivery preferences, and templates for your alerts.</p>
                </div>
                 <Button 
                    onClick={handleSave} 
                    className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Settings
                </Button>
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                {/* Manage Notification Channels Card */} 
                <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                             <BellRing className="h-5 w-5 text-trendy-yellow" />
                            <CardTitle className="text-white font-orbitron">Manage Notification Channels</CardTitle>
                        </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">Connect and configure where you receive alerts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Email Section (Display Only) */} 
                        <div className="flex items-center justify-between p-4 border border-neutral-700 rounded-md">
                             <div className="space-y-1">
                                <Label className="text-base text-neutral-200">Email</Label>
                                <p className="text-sm text-neutral-400">Notifications will be sent to: {user?.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-green-400 bg-green-900/50 px-2 py-1 rounded-md border border-green-700">Connected</span>
                                <Button size="sm" variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Test (Soon)</Button>
                            </div>
                        </div>
                        {/* Telegram Section */} 
                        <div className="p-4 border border-neutral-700 rounded-md space-y-2">
                             <div className="flex items-center justify-between">
                                <Label className="text-base text-neutral-200">Telegram</Label>
                                <span className="text-xs font-medium text-neutral-500 bg-neutral-700/50 px-2 py-1 rounded-md border border-neutral-600">Not Connected</span>
                            </div>
                            <Label htmlFor="telegramChatId" className="text-sm text-neutral-400">Bot Chat ID</Label>
                            <Input 
                                id="telegramChatId" 
                                name="telegramChatId"
                                placeholder="Enter the Chat ID from the trendy Bot"
                                value={settings.telegramChatId}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                             <p className="text-xs text-neutral-500">Start a chat with the trendy Telegram Bot and enter the provided ID.</p>
                            <div className="flex justify-end gap-2 pt-2">
                                    <Button size="sm" variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Test (Soon)</Button>
                                    <Button size="sm" variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Connect Telegram (Soon)</Button>
                            </div>
                        </div>
                        {/* Discord Section */} 
                        <div className="p-4 border border-neutral-700 rounded-md space-y-2">
                                <div className="flex items-center justify-between">
                                <Label className="text-base text-neutral-200">Discord</Label>
                                <span className="text-xs font-medium text-neutral-500 bg-neutral-700/50 px-2 py-1 rounded-md border border-neutral-600">Not Connected</span>
                            </div>
                            <Label htmlFor="discordWebhookUrl" className="text-sm text-neutral-400">Webhook URL</Label>
                            <Input 
                                id="discordWebhookUrl" 
                                name="discordWebhookUrl"
                                placeholder="Enter your Discord Webhook URL"
                                value={settings.discordWebhookUrl}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                            <p className="text-xs text-neutral-500">Create a webhook integration in your Discord server settings.</p>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button size="sm" variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Test (Soon)</Button>
                                    <Button size="sm" variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Connect Discord (Soon)</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 {/* Delivery Preferences Card */} 
                 <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                        <CardTitle className="text-white font-orbitron">Delivery Preferences</CardTitle>
                        <CardDescription className="text-neutral-400">Choose how often you want to receive notifications.</CardDescription>
                    </CardHeader>
                    <CardContent>
                            <Select 
                                value={settings.deliveryPreference} 
                                onValueChange={handleSelectChange}
                            >
                            <SelectTrigger className="w-[280px] bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow">
                                <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                                <SelectItem value="Instantly" className="focus:bg-neutral-700 focus:text-white">Instantly (Recommended)</SelectItem>
                                <SelectItem value="Hourly" className="focus:bg-neutral-700 focus:text-white">Hourly Digest</SelectItem>
                                <SelectItem value="Daily" className="focus:bg-neutral-700 focus:text-white">Daily Digest</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>

                {/* Hidden submit */} 
                <button type="submit" className="hidden">Submit</button>
            </form>
        </div>
    );
};

export default NotificationSettings; 