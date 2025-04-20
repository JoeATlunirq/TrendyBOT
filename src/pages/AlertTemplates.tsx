import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, Wand2, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Keep tabs for structure

// Determine the base API URL based on the environment
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api'; // Use relative path for Vercel production
  } else {
    // Use local backend URL for development
    return 'http://localhost:5001/api';
  }
};
const BACKEND_API_BASE_URL = getApiBaseUrl();

// Define type for templates state
type AlertTemplatesState = {
    templateTelegram: string;
    templateDiscord: string;
    templateEmailSubject: string;
    templateEmailPreview: string;
};

// Column Names (Hardcoded - ensure match backend .env/NocoDB)
const TEMPLATE_TELEGRAM_COLUMN = 'alert_template_telegram';
const TEMPLATE_DISCORD_COLUMN = 'alert_template_discord';
const TEMPLATE_EMAIL_SUBJECT_COLUMN = 'alert_template_email_subject';
const TEMPLATE_EMAIL_PREVIEW_COLUMN = 'alert_template_email_preview';

// Default Templates (as fallback)
const defaultTemplates: AlertTemplatesState = {
    templateTelegram: "🔥 TRENDING: {video_title}\n\n📈 {views} views • {likes} likes • {comments} comments\n\n👤 {channel_name}\n\n🕒 Posted {time_ago}\n\n👉 {video_url}",
    templateDiscord: "**🔥 TRENDING VIDEO ALERT 🔥**\n\n**Title:** {video_title}\n**Channel:** {channel_name}\n\n**Stats:** 📈 {views} views | 👍 {likes} likes | 💬 {comments} comments\n**Posted:** {time_ago}\n\n{video_url}",
    templateEmailSubject: "🔥 New Trending Shorts Alert from Trendy",
    templateEmailPreview: "A new video is trending: {video_title}"
};

const availableVariables = "{video_title}, {views}, {likes}, {comments}, {channel_name}, {time_ago}, {video_url}";

const AlertTemplates = () => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [templates, setTemplates] = useState<AlertTemplatesState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch current templates on load
    useEffect(() => {
        const fetchTemplates = async () => {
            if (!token) return;
            setIsLoading(true);
            try {
                const response = await axios.get(`${BACKEND_API_BASE_URL}/users/alert-templates`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                // Map response, falling back to defaults if needed
                setTemplates({
                    templateTelegram: response.data[TEMPLATE_TELEGRAM_COLUMN] || defaultTemplates.templateTelegram,
                    templateDiscord: response.data[TEMPLATE_DISCORD_COLUMN] || defaultTemplates.templateDiscord,
                    templateEmailSubject: response.data[TEMPLATE_EMAIL_SUBJECT_COLUMN] || defaultTemplates.templateEmailSubject,
                    templateEmailPreview: response.data[TEMPLATE_EMAIL_PREVIEW_COLUMN] || defaultTemplates.templateEmailPreview,
                });
            } catch (error: any) {
                console.error("Failed to fetch alert templates:", error);
                toast({ title: "Error Loading Templates", description: error.response?.data?.message || error.message, variant: "destructive" });
                setTemplates(defaultTemplates); // Load defaults on error
            } finally {
                setIsLoading(false);
            }
        };
        fetchTemplates();
    }, [token, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTemplates(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleReset = (field: keyof AlertTemplatesState) => {
        setTemplates(prev => prev ? { ...prev, [field]: defaultTemplates[field] } : null);
        toast({ title: "Template Reset", description: `${field} reset to default.` });
    }

    const handleSaveTemplates = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !templates) return;
        setIsSaving(true);

        try {
            const response = await axios.put(
                `${BACKEND_API_BASE_URL}/users/alert-templates`,
                templates, // Send the whole state object
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
            toast({ title: "Templates Saved", description: response.data?.message || "Alert templates updated successfully." });
            // Optionally update state with response.data.templates if needed
        } catch (error: any) {
             const message = error.response?.data?.message || "Failed to save templates.";
            toast({ title: "Save Failed", description: message, variant: "destructive" });
            console.error("Save templates error:", error.response?.data || error);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="container mx-auto py-8 px-4 md:px-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    if (!templates) {
         return <div className="container mx-auto py-8 px-4 md:px-6 text-center text-red-400">Failed to load templates. Please try again later.</div>;
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl">
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white font-orbitron">Alert Templates</h1>
                    <p className="text-neutral-400">Configure how and where you want to receive trend alerts.</p> 
                </div>
                 <Button 
                    onClick={handleSaveTemplates} 
                    className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Templates
                </Button>
            </div>

            {/* Using Tabs for structure, could be simple Cards too */} 
            <form onSubmit={handleSaveTemplates}>
                <Tabs defaultValue="telegram" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6 bg-neutral-800/50 border border-neutral-700/50 p-1 h-auto">
                        <TabsTrigger value="telegram" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Telegram</TabsTrigger>
                        <TabsTrigger value="discord" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Discord</TabsTrigger>
                        <TabsTrigger value="email" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Email</TabsTrigger>
                    </TabsList>

                    {/* --- Telegram Template --- */} 
                    <TabsContent value="telegram">
                        <Card className="bg-neutral-800/50 border-neutral-700/50">
                            <CardHeader>
                                <CardTitle className="text-white font-orbitron">Telegram Template</CardTitle>
                                <CardDescription className="text-neutral-400 flex items-start gap-2">
                                     <Info size={16} className="mt-1 flex-shrink-0"/> 
                                     <span>Customize the message sent to your Telegram channel. Use the available variables below.</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                 <Label htmlFor="templateTelegram" className="text-neutral-300">Message Content</Label>
                                 <Textarea 
                                    id="templateTelegram"
                                    name="templateTelegram"
                                    value={templates.templateTelegram}
                                    onChange={handleInputChange}
                                    rows={8}
                                    className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow font-mono text-sm"
                                />
                                 <p className="text-xs text-neutral-500">
                                     Available variables: <code className="bg-neutral-700 px-1 py-0.5 rounded">{availableVariables}</code>
                                </p>
                            </CardContent>
                             <CardFooter className="justify-end">
                                <Button type="button" variant="ghost" onClick={() => handleReset('templateTelegram')} className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-2">Reset to Default</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* --- Discord Template --- */} 
                    <TabsContent value="discord">
                        <Card className="bg-neutral-800/50 border-neutral-700/50">
                             <CardHeader>
                                <CardTitle className="text-white font-orbitron">Discord Template</CardTitle>
                                <CardDescription className="text-neutral-400 flex items-start gap-2">
                                     <Info size={16} className="mt-1 flex-shrink-0"/> 
                                     <span>Customize the message sent via Discord webhook. Supports Markdown.</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                 <Label htmlFor="templateDiscord" className="text-neutral-300">Message Content (Markdown supported)</Label>
                                 <Textarea 
                                    id="templateDiscord"
                                    name="templateDiscord"
                                    value={templates.templateDiscord}
                                    onChange={handleInputChange}
                                    rows={8}
                                     className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow font-mono text-sm"
                                />
                                <p className="text-xs text-neutral-500">
                                     Available variables: <code className="bg-neutral-700 px-1 py-0.5 rounded">{availableVariables}</code>
                                </p>
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button type="button" variant="ghost" onClick={() => handleReset('templateDiscord')} className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-2">Reset to Default</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>

                    {/* --- Email Template --- */} 
                    <TabsContent value="email">
                        <Card className="bg-neutral-800/50 border-neutral-700/50">
                             <CardHeader>
                                <CardTitle className="text-white font-orbitron">Email Template</CardTitle>
                                <CardDescription className="text-neutral-400 flex items-start gap-2">
                                    <Info size={16} className="mt-1 flex-shrink-0"/> 
                                    <span>Customize the subject and preview text for email alerts. The body uses a standard HTML layout.</span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="templateEmailSubject" className="text-neutral-300">Subject Line</Label>
                                    <Input 
                                        id="templateEmailSubject"
                                        name="templateEmailSubject"
                                        value={templates.templateEmailSubject}
                                        onChange={handleInputChange}
                                         className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    />
                                </div>
                                <div className="space-y-2">
                                     <Label htmlFor="templateEmailPreview" className="text-neutral-300">Preview Text (Preheader)</Label>
                                    <Textarea 
                                        id="templateEmailPreview"
                                        name="templateEmailPreview"
                                        value={templates.templateEmailPreview}
                                        onChange={handleInputChange}
                                        rows={3}
                                         className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow font-mono text-sm"
                                    />
                                </div>
                                 <p className="text-xs text-neutral-500">
                                     Available variables: <code className="bg-neutral-700 px-1 py-0.5 rounded">{availableVariables}</code>
                                </p>
                            </CardContent>
                           <CardFooter className="justify-end">
                                <Button type="button" variant="ghost" onClick={() => { handleReset('templateEmailSubject'); handleReset('templateEmailPreview'); }} className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-2">Reset to Defaults</Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>
                 {/* Hidden submit button for form semantics */} 
                 <button type="submit" className="hidden">Submit</button>
            </form>
        </div>
    );
};

export default AlertTemplates; 