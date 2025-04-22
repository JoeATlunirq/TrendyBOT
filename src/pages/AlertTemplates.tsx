import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAlertTemplatesStore } from '@/stores/alertTemplatesStore';

// Re-define type here if not exporting from store, or import it
type AlertTemplatesData = {
    templateTelegram: string;
    templateDiscord: string;
    templateEmailSubject: string;
    templateEmailPreview: string;
};

// Remove local constants (defaults, columns, API URL) - managed by store

const availableVariables = "{video_title}, {views}, {likes}, {comments}, {channel_name}, {time_ago}, {video_url}";

const AlertTemplates = () => {
    const { token } = useAuth();
    
    // --- Use Zustand Store ---
    const templates = useAlertTemplatesStore(state => state.templates);
    const isLoading = useAlertTemplatesStore(state => state.isLoading);
    const isSaving = useAlertTemplatesStore(state => state.isSaving);
    const isResetting = useAlertTemplatesStore(state => state.isResetting); // Get resetting state
    const { 
        fetchTemplates, 
        setTemplateField, 
        resetTemplateField, 
        saveTemplates 
    } = useAlertTemplatesStore(state => state.actions);
    // ------------------------

    // --- Local State for Active Tab ---
    const TABS_STORAGE_KEY = 'alertTemplates_activeTab';
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem(TABS_STORAGE_KEY) || 'telegram'; // Default to telegram
    });

    // Update localStorage when activeTab changes
    useEffect(() => {
        localStorage.setItem(TABS_STORAGE_KEY, activeTab);
    }, [activeTab]);
    // --------------------------------

    // Fetch templates on mount or when token changes
    useEffect(() => {
        fetchTemplates(token); // Call the store action
    }, [token, fetchTemplates]);
    
    // Log specific template value when state updates
    useEffect(() => {
        if (templates) {
            // Log the specific value reacting components care about (raw string)
            console.log(`[useEffect] templates state updated. templateTelegram raw value is now:\n--- START ---\n${templates.templateTelegram}\n--- END ---`);
        }
    }, [templates]); // Dependency array ensures this runs when templates object reference changes

    // --- Event Handlers (now call store actions) ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        // Cast name to keyof AlertTemplatesData after checking existence
        if (name in (templates || {})) { 
            setTemplateField(name as keyof AlertTemplatesData, value); 
        }
    };

    // Separate handler for combined email reset
    const handleResetEmailFields = () => {
        // Pass token to reset actions
        resetTemplateField('templateEmailSubject', token);
        resetTemplateField('templateEmailPreview', token);
    }

    // Wrapper for save button onClick
    const handleSaveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault(); // Prevent default form submission if button is inside form
        saveTemplates(token); // Call the store action
    }

    // Handler for Tab Change
    const handleTabChange = (value: string) => {
        setActiveTab(value);
    }
    // --------------------------------------------------

    if (isLoading) {
        return <div className="container mx-auto py-8 px-4 md:px-6 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
    }

    if (!templates) {
         // Store now handles default state, so !templates implies an error state during/after fetch
         return <div className="container mx-auto py-8 px-4 md:px-6 text-center text-red-400">Failed to load template data. Please try refreshing.</div>;
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl">
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white font-orbitron">Alert Templates</h1>
                    <p className="text-neutral-400">Configure how and where you want to receive trend alerts.</p> 
                </div>
                 <Button 
                    onClick={handleSaveClick} // Use the specific click handler
                    className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                    disabled={isSaving || isLoading} // Disable if saving OR initial loading
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Templates
                </Button>
            </div>

            {/* Form tag might be redundant now, but keep for structure if needed */}
            {/* Remove onSubmit={handleSaveTemplates} if form is kept */}
            <form>
                <Tabs 
                    value={activeTab} 
                    onValueChange={handleTabChange} 
                    defaultValue="telegram" // Keep defaultValue for initial hydration if needed
                    className="w-full"
                >
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
                                    name="templateTelegram" // Name is used by handleInputChange
                                    value={templates.templateTelegram} // Get value from store
                                    onChange={handleInputChange} // Use updated handler
                                    rows={8}
                                    className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow font-mono text-sm"
                                    style={{ whiteSpace: 'pre-wrap' }} // Add style for newline handling
                                />
                                 <p className="text-xs text-neutral-500">
                                     Available variables: <code className="bg-neutral-700 px-1 py-0.5 rounded">{availableVariables}</code>
                                </p>
                            </CardContent>
                             <CardFooter className="justify-end">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => resetTemplateField('templateTelegram', token)} // Pass token
                                    disabled={isResetting.templateTelegram} // Disable if resetting this field
                                    className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-2"
                                >
                                    {isResetting.templateTelegram ? <Loader2 className="mr-2 h-4 w-4 animate-spin -ml-1" /> : null}
                                    Reset to Default
                                </Button>
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
                                    name="templateDiscord" // Name used by handleInputChange
                                    value={templates.templateDiscord} // Get value from store
                                    onChange={handleInputChange} // Use updated handler
                                    rows={8}
                                     className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow font-mono text-sm"
                                    style={{ whiteSpace: 'pre-wrap' }} // Add style for newline handling
                                />
                                <p className="text-xs text-neutral-500">
                                     Available variables: <code className="bg-neutral-700 px-1 py-0.5 rounded">{availableVariables}</code>
                                </p>
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={() => resetTemplateField('templateDiscord', token)} // Pass token
                                    disabled={isResetting.templateDiscord} // Disable if resetting this field
                                    className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-2"
                                >
                                    {isResetting.templateDiscord ? <Loader2 className="mr-2 h-4 w-4 animate-spin -ml-1" /> : null}
                                    Reset to Default
                                </Button>
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
                                        name="templateEmailSubject" // Name used by handleInputChange
                                        value={templates.templateEmailSubject} // Get value from store
                                        onChange={handleInputChange} // Use updated handler
                                         className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    />
                                </div>
                                <div className="space-y-2">
                                     <Label htmlFor="templateEmailPreview" className="text-neutral-300">Preview Text (Preheader)</Label>
                                    <Textarea 
                                        id="templateEmailPreview"
                                        name="templateEmailPreview" // Name used by handleInputChange
                                        value={templates.templateEmailPreview} // Get value from store
                                        onChange={handleInputChange} // Use updated handler
                                        rows={3}
                                         className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow font-mono text-sm"
                                        style={{ whiteSpace: 'pre-wrap' }} // Add style for newline handling
                                    />
                                </div>
                                 <p className="text-xs text-neutral-500">
                                     Available variables: <code className="bg-neutral-700 px-1 py-0.5 rounded">{availableVariables}</code>
                                </p>
                            </CardContent>
                           <CardFooter className="justify-end">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    onClick={handleResetEmailFields} // Use combined handler (passes token inside)
                                    disabled={isResetting.templateEmailSubject || isResetting.templateEmailPreview} // Disable if resetting either field
                                    className="text-neutral-400 hover:text-white hover:bg-neutral-700/50 mr-2"
                                >
                                    {(isResetting.templateEmailSubject || isResetting.templateEmailPreview) ? <Loader2 className="mr-2 h-4 w-4 animate-spin -ml-1" /> : null}
                                    Reset to Defaults
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                </Tabs>
                 {/* Hidden submit button is no longer needed as save is triggered explicitly */}
                 {/* <button type="submit" className="hidden">Submit</button> */}
            </form>
        </div>
    );
};

export default AlertTemplates; 