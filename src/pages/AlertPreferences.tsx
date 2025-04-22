import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Filter, TrendingUp } from 'lucide-react';
import { useAlertPreferencesStore, METRIC_KEYS } from '@/stores/alertPreferencesStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define types based on store structure (or import if exported from store)
// No longer needed here as we directly use store types

const AlertPreferences = () => {
    const { token } = useAuth();
    
    // --- Use Zustand Store ---
    const thresholds = useAlertPreferencesStore(state => state.thresholds);
    const filters = useAlertPreferencesStore(state => state.filters);
    const isLoading = useAlertPreferencesStore(state => state.isLoading);
    const isSaving = useAlertPreferencesStore(state => state.isSavingThresholds);
    const isResetting = useAlertPreferencesStore(state => state.isResettingThresholds);
    const {
        fetchPreferences,
        setThresholdField,
        setFilterField,
        saveThresholds,
        resetThresholds
    } = useAlertPreferencesStore(state => state.actions);
    // ------------------------

    // Fetch preferences on mount or token change
    useEffect(() => {
        fetchPreferences(token);
    }, [token, fetchPreferences]);

    // --- Event Handlers ---
    const handleThresholdInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setThresholdField(name as any, value);
    };

    const handleThresholdSelectChange = (name: string, value: string) => {
        setThresholdField(name as any, value);
    };

    const handleFilterInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilterField(name as keyof typeof filters, value);
    };

    // Combined Save/Reset Handlers
    const handleSavePreferencesClick = () => saveThresholds(token);
    const handleResetPreferencesClick = () => resetThresholds(token);
    // --------------------------------------------------

    if (isLoading) {
        return <div className="container mx-auto py-8 px-4 md:px-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    // Check if either state object from store is null
    if (!thresholds || !filters) {
         return <div className="container mx-auto py-8 px-4 md:px-6 text-center text-red-400">Failed to load preferences. Please try refreshing.</div>;
    }

    const getNullableInputValue = (value: number | null | undefined): string => {
        return value === null || value === undefined ? '' : String(value);
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white font-orbitron">Alert Preferences</h1>
                <p className="text-neutral-400">Configure thresholds and filters for your YouTube Shorts alerts.</p>
            </div>

            <div className="space-y-8">
                {/* Filters Section (Step 1) */}
                <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                             <Filter className="h-5 w-5 text-trendy-yellow" />
                             <CardTitle className="text-white font-orbitron">Step 1: Define Content Scope</CardTitle>
                        </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">Specify which channels you want to monitor for alerts.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-6">
                        {/* Channels - Updated Label and Help Text */}
                        <div className="space-y-2">
                            <Label htmlFor="filterChannels" className="text-neutral-300">Filter by YouTube Channel ID(s)</Label>
                            <Input
                                id="filterChannels"
                                name="filterChannels"
                                placeholder="UCxxxxxxxxxxxxxxxxx, UCyyyyyyyyyyyyyyyyy"
                                value={filters.filterChannels}
                                onChange={handleFilterInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                            <p className="text-xs text-neutral-500">
                                Enter one or more YouTube Channel IDs, separated by commas. Find the ID in the channel's URL (e.g., youtube.com/channel/&lt;Channel ID&gt;). Leave blank to monitor all relevant channels.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                 {/* Thresholds Section (Step 2) */}
                <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                         <div className="flex items-center gap-2">
                             <TrendingUp className="h-5 w-5 text-trendy-yellow" />
                             <CardTitle className="text-white font-orbitron">Step 2: Set Alert Conditions</CardTitle>
                         </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">Define the metric conditions that trigger alerts for the content specified above.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8">
                        {/* Views - Updated Layout */}
                        <div className="space-y-2">
                            <Label htmlFor="thresholdViews" className="text-neutral-300">Views Threshold</Label>
                            <div className="flex gap-3 items-center">
                                <Input
                                    id="thresholdViews"
                                    name="thresholdViews"
                                    type="number"
                                    placeholder="e.g., 10000"
                                    value={thresholds.thresholdViews}
                                    onChange={handleThresholdInputChange}
                                    className="flex-grow bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                />
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <Label htmlFor="thresholdViewsTimeWindowHours" className="text-xs text-neutral-400">Within</Label>
                                    <Input
                                        id="thresholdViewsTimeWindowHours"
                                        name="thresholdViewsTimeWindowHours"
                                        type="number"
                                        placeholder="Hours"
                                        value={getNullableInputValue(thresholds.thresholdViewsTimeWindowHours)}
                                        onChange={handleThresholdInputChange}
                                        className="w-20 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-xs p-2"
                                    />
                                     <span className="text-xs text-neutral-400">Hrs</span>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Min views required. Optionally set time limit (hours after posting).</p>
                        </div>
                        {/* Likes - Updated Layout */}
                        <div className="space-y-2">
                            <Label htmlFor="thresholdLikes" className="text-neutral-300">Likes Threshold</Label>
                             <div className="flex gap-3 items-center">
                                <Input
                                    id="thresholdLikes"
                                    name="thresholdLikes"
                                    type="number"
                                    placeholder="e.g., 1000"
                                    value={thresholds.thresholdLikes}
                                    onChange={handleThresholdInputChange}
                                    className="flex-grow bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                />
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <Label htmlFor="thresholdLikesTimeWindowHours" className="text-xs text-neutral-400">Within</Label>
                                    <Input
                                        id="thresholdLikesTimeWindowHours"
                                        name="thresholdLikesTimeWindowHours"
                                        type="number"
                                        placeholder="Hours"
                                        value={getNullableInputValue(thresholds.thresholdLikesTimeWindowHours)}
                                        onChange={handleThresholdInputChange}
                                        className="w-20 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-xs p-2"
                                    />
                                     <span className="text-xs text-neutral-400">Hrs</span>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Min likes required. Optionally set time limit (hours after posting).</p>
                        </div>
                         {/* Comments - Updated Layout */}
                         <div className="space-y-2">
                            <Label htmlFor="thresholdComments" className="text-neutral-300">Comments Threshold</Label>
                             <div className="flex gap-3 items-center">
                                <Input
                                    id="thresholdComments"
                                    name="thresholdComments"
                                    type="number"
                                    placeholder="e.g., 100"
                                    value={thresholds.thresholdComments}
                                    onChange={handleThresholdInputChange}
                                    className="flex-grow bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                />
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <Label htmlFor="thresholdCommentsTimeWindowHours" className="text-xs text-neutral-400">Within</Label>
                                    <Input
                                        id="thresholdCommentsTimeWindowHours"
                                        name="thresholdCommentsTimeWindowHours"
                                        type="number"
                                        placeholder="Hours"
                                        value={getNullableInputValue(thresholds.thresholdCommentsTimeWindowHours)}
                                        onChange={handleThresholdInputChange}
                                        className="w-20 bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-xs p-2"
                                    />
                                    <span className="text-xs text-neutral-400">Hrs</span>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Min comments required. Optionally set time limit (hours after posting).</p>
                        </div>
                         {/* Velocity */}
                         <div className="space-y-2">
                            <Label htmlFor="thresholdVelocity" className="text-neutral-300">Engagement Velocity (Views/Hour)</Label>
                            <Input
                                id="thresholdVelocity"
                                name="thresholdVelocity"
                                type="number"
                                value={thresholds.thresholdVelocity}
                                onChange={handleThresholdInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                            />
                             <p className="text-xs text-neutral-500">Minimum views gained per hour.</p>
                        </div>

                        {/* --- Relative Performance --- */}
                        <div className="space-y-4 p-4 rounded-md border border-neutral-700/60 bg-neutral-800/40 lg:col-span-2 flex flex-col sm:flex-row sm:items-end gap-4">
                            <div className="space-y-2 flex-grow">
                                <Label htmlFor="thresholdRelativeViewPerformancePercent" className="text-neutral-300">Relative Performance Threshold (%)</Label>
                                <Input
                                    id="thresholdRelativeViewPerformancePercent"
                                    name="thresholdRelativeViewPerformancePercent"
                                    type="number"
                                    placeholder="e.g., 150 (means 150% of avg)"
                                    value={getNullableInputValue(thresholds.thresholdRelativeViewPerformancePercent)}
                                    onChange={handleThresholdInputChange}
                                    className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                />
                                <p className="text-xs text-neutral-500">Trigger if views exceed this % of the selected average. Leave blank to disable.</p>
                            </div>
                            <div className="space-y-2 sm:w-[200px]">
                                <Select
                                    name="thresholdRelativeViewMetric"
                                    value={thresholds.thresholdRelativeViewMetric}
                                    onValueChange={(value) => handleThresholdSelectChange('thresholdRelativeViewMetric', value)}
                                >
                                    <SelectTrigger className="w-full bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow">
                                        <SelectValue placeholder="Select avg..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-800 border-neutral-600 text-white">
                                        <SelectItem value="7d_avg_views" className="hover:bg-neutral-700 focus:bg-neutral-700 cursor-pointer">7-Day Avg Views</SelectItem>
                                        <SelectItem value="14d_avg_views" className="hover:bg-neutral-700 focus:bg-neutral-700 cursor-pointer">14-Day Avg Views</SelectItem>
                                        <SelectItem value="30d_avg_views" className="hover:bg-neutral-700 focus:bg-neutral-700 cursor-pointer">30-Day Avg Views</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-neutral-500 sm:invisible">.</p>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-end gap-3 pt-6">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleResetPreferencesClick}
                            disabled={isResetting}
                            className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-auto"
                        >
                             {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin -ml-1" /> : null}
                             Reset All Preferences
                        </Button>
                        <Button
                            onClick={handleSavePreferencesClick}
                            className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save All Preferences
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default AlertPreferences; 