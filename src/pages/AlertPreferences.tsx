import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Filter, TrendingUp } from 'lucide-react';

// Get backend URL
const BACKEND_API_BASE_URL = 'http://localhost:5001/api';

// Define type for preferences state
type AlertPreferencesState = {
    thresholdViews: number;
    thresholdLikes: number;
    thresholdComments: number;
    thresholdVelocity: number;
    filterChannels: string;
    filterNiches: string;
    filterHashtags: string;
};

// Column Names (Hardcoded - ensure match backend .env/NocoDB)
const THRESHOLD_VIEWS_COLUMN = 'threshold_views';
const THRESHOLD_LIKES_COLUMN = 'threshold_likes';
const THRESHOLD_COMMENTS_COLUMN = 'threshold_comments';
const THRESHOLD_VELOCITY_COLUMN = 'threshold_velocity';
const FILTER_CHANNELS_COLUMN = 'filter_channels';
const FILTER_NICHES_COLUMN = 'filter_niches';
const FILTER_HASHTAGS_COLUMN = 'filter_hashtags';

const AlertPreferences = () => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [preferences, setPreferences] = useState<AlertPreferencesState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch current preferences on load
    useEffect(() => {
        const fetchPreferences = async () => {
            if (!token) return;
            setIsLoading(true);
            try {
                const response = await axios.get(`${BACKEND_API_BASE_URL}/users/alert-preferences`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                // Map response keys (which should match NocoDB columns) to state keys
                setPreferences({
                    thresholdViews: response.data[THRESHOLD_VIEWS_COLUMN] ?? 0,
                    thresholdLikes: response.data[THRESHOLD_LIKES_COLUMN] ?? 0,
                    thresholdComments: response.data[THRESHOLD_COMMENTS_COLUMN] ?? 0,
                    thresholdVelocity: response.data[THRESHOLD_VELOCITY_COLUMN] ?? 0,
                    filterChannels: response.data[FILTER_CHANNELS_COLUMN] ?? '',
                    filterNiches: response.data[FILTER_NICHES_COLUMN] ?? '',
                    filterHashtags: response.data[FILTER_HASHTAGS_COLUMN] ?? '',
                });
            } catch (error: any) {
                console.error("Failed to fetch alert preferences:", error);
                toast({ title: "Error Loading Preferences", description: error.response?.data?.message || error.message, variant: "destructive" });
            } finally {
                setIsLoading(false);
            }
        };
        fetchPreferences();
    }, [token, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPreferences(prev => prev ? { ...prev, [name]: value } : null);
    };

    const handleSavePreferences = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token || !preferences) return;
        setIsSaving(true);

        try {
             // Send state keys, backend controller maps them to NocoDB columns
            const response = await axios.put(
                `${BACKEND_API_BASE_URL}/users/alert-preferences`,
                preferences, // Send the whole state object
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
            toast({ title: "Preferences Saved", description: response.data?.message || "Alert preferences updated successfully." });
            // Optionally update state with response.data.preferences if needed
        } catch (error: any) {
             const message = error.response?.data?.message || "Failed to save preferences.";
            toast({ title: "Save Failed", description: message, variant: "destructive" });
            console.error("Save preferences error:", error.response?.data || error);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="container mx-auto py-8 px-4 md:px-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    if (!preferences) {
         return <div className="container mx-auto py-8 px-4 md:px-6 text-center text-red-400">Failed to load preferences. Please try again later.</div>;
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white font-orbitron">Alert Preferences</h1>
                    <p className="text-neutral-400">Configure thresholds and filters for your YouTube Shorts alerts.</p>
                </div>
                <Button 
                    onClick={handleSavePreferences} 
                    className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Preferences
                </Button>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-8">
                {/* Alert Thresholds Section */} 
                <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                         <div className="flex items-center gap-2">
                             <TrendingUp className="h-5 w-5 text-trendy-yellow" />
                            <CardTitle className="text-white font-orbitron">Alert Thresholds</CardTitle>
                         </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">Set the minimum metrics a Short must reach to trigger an alert.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="thresholdViews" className="text-neutral-300">Views Threshold</Label>
                            <Input 
                                id="thresholdViews" 
                                name="thresholdViews"
                                type="number"
                                value={preferences.thresholdViews}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                            <p className="text-xs text-neutral-500">Minimum total views.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="thresholdLikes" className="text-neutral-300">Likes Threshold</Label>
                            <Input 
                                id="thresholdLikes" 
                                name="thresholdLikes"
                                type="number"
                                value={preferences.thresholdLikes}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                            <p className="text-xs text-neutral-500">Minimum total likes.</p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="thresholdComments" className="text-neutral-300">Comments Threshold</Label>
                            <Input 
                                id="thresholdComments" 
                                name="thresholdComments"
                                type="number"
                                value={preferences.thresholdComments}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                            <p className="text-xs text-neutral-500">Minimum total comments.</p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="thresholdVelocity" className="text-neutral-300">Engagement Velocity (Views/Hour)</Label>
                            <Input 
                                id="thresholdVelocity" 
                                name="thresholdVelocity"
                                type="number"
                                value={preferences.thresholdVelocity}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                             <p className="text-xs text-neutral-500">Minimum views gained per hour.</p>
                        </div>
                    </CardContent>
                </Card>

                 {/* Filters Section */} 
                <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                             <Filter className="h-5 w-5 text-trendy-yellow" />
                             <CardTitle className="text-white font-orbitron">Filters</CardTitle>
                        </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">Optionally filter alerts by specific channels, niches, or hashtags.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="filterChannels" className="text-neutral-300">Filter by Channel(s)</Label>
                            <Input 
                                id="filterChannels" 
                                name="filterChannels"
                                placeholder="Enter channel IDs, comma-separated" 
                                value={preferences.filterChannels}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                            <p className="text-xs text-neutral-500">Leave blank to monitor all channels.</p>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="filterNiches" className="text-neutral-300">Filter by Niche(s)</Label>
                            <Input 
                                id="filterNiches" 
                                name="filterNiches"
                                placeholder="e.g., gaming, finance, cooking" 
                                value={preferences.filterNiches}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                             <p className="text-xs text-neutral-500">Enter niches, comma-separated.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="filterHashtags" className="text-neutral-300">Filter by Hashtag(s)</Label>
                            <Input 
                                id="filterHashtags" 
                                name="filterHashtags"
                                placeholder="#shorts, #viral, #challenge" 
                                value={preferences.filterHashtags}
                                onChange={handleInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                             <p className="text-xs text-neutral-500">Enter hashtags including '#', comma-separated.</p>
                        </div>
                    </CardContent>
                    {/* No separate save button needed here as the top button saves all */} 
                </Card>

                 {/* Hidden submit button for form semantics if needed, or rely on top button */} 
                 {/* <button type="submit" className="hidden">Submit</button> */}
            </form>
        </div>
    );
};

export default AlertPreferences; 