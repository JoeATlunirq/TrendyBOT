import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, BellRing, Send, CheckCircle, XCircle, KeyRound, Link as LinkIcon, Unlink } from 'lucide-react';

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

// Define type for state
type NotificationSettings = {
    telegramChatId: string | null;
    discordWebhookUrl: string | null;
    deliveryPreference: string;
};

// Update the TelegramStatus type to be more specific
type TelegramStatus = 
    | 'initial'           // Initial state
    | 'entering_chat_id'  // Step 1: User is entering chat ID
    | 'requesting_code'   // Transition: Requesting verification code
    | 'entering_code'     // Step 2: User is entering verification code
    | 'verifying_code'    // Transition: Verifying the code
    | 'connected'         // Final: Successfully connected
    | 'error';           // Error state

// Column Names (Hardcoded - ensure match backend .env/NocoDB)
// const TELEGRAM_ID_COLUMN = 'telegram_chat_id'; // No longer fetched directly like this
const DISCORD_URL_COLUMN = 'discord_webhook_url';
const DELIVERY_PREF_COLUMN = 'delivery_preference';

// Add this type outside the component
type TelegramVerificationState = {
    status: TelegramStatus;
    chatId: string;
    error: string | null;
    isConnecting: boolean;
    codeInput: string;
    verificationSession?: string; // Add this to store the verification session
};

// Helper functions for session storage
const getStoredTelegramState = (): TelegramVerificationState | null => {
    const stored = sessionStorage.getItem('telegramVerificationState');
    return stored ? JSON.parse(stored) : null;
};

const setStoredTelegramState = (state: TelegramVerificationState) => {
    sessionStorage.setItem('telegramVerificationState', JSON.stringify(state));
};

const NotificationSettings = () => {
    const { user, token } = useAuth();
    const { settings, updateSettings, isLoading: isSettingsLoading } = useUserSettings();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState<string | null>(null);
    const [localSettings, setLocalSettings] = useState<NotificationSettings | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize with clearer states
    const [telegramState, setTelegramState] = useState<TelegramVerificationState>(() => {
        const stored = getStoredTelegramState();
        if (stored) {
            return stored;
        }
        return {
            status: 'initial',
            chatId: '',
            error: null,
            isConnecting: false,
            codeInput: ''
        };
    });

    // Update session storage whenever telegramState changes
    const updateTelegramState = useCallback((newState: TelegramVerificationState | ((prev: TelegramVerificationState) => TelegramVerificationState)) => {
        setTelegramState(prev => {
            const nextState = typeof newState === 'function' ? newState(prev) : newState;
            setStoredTelegramState(nextState);
            return nextState;
        });
    }, []);

    // Update the initialization effect
    useEffect(() => {
        if (!settings?.notificationSettings) return;
        
        const hasTelegramId = settings.notificationSettings.telegramChatId;
        
        // Only update based on settings if we are NOT in a verification step
        // AND the status isn't already reflecting the settings correctly.
        if (!['entering_code', 'verifying_code', 'requesting_code'].includes(telegramState.status)) {
            const expectedStatus = hasTelegramId ? 'connected' : 'entering_chat_id';
            if (telegramState.status !== expectedStatus) {
                 updateTelegramState(prev => ({
                    ...prev,
                    status: expectedStatus,
                    chatId: hasTelegramId || '',
                    error: null,
                    isConnecting: false,
                    codeInput: ''
                }));
            }
        }
    }, [settings?.notificationSettings?.telegramChatId, telegramState.status, updateTelegramState]); // Add telegramState.status to dependency

    // Fetch settings only once on load
    const fetchSettings = useCallback(async () => {
        if (!token) return;
        
        try {
            const response = await axios.get(`${BACKEND_API_BASE_URL}/users/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const fetchedTelegramId = response.data?.telegram_chat_id;
            
            if (telegramState.status !== 'entering_code' && telegramState.status !== 'verifying_code') {
                updateTelegramState(prev => ({
                    ...prev,
                    status: fetchedTelegramId ? 'connected' : 'entering_chat_id',
                    chatId: fetchedTelegramId || '',
                    error: null
                }));
            }

            setLocalSettings({
                telegramChatId: fetchedTelegramId,
                discordWebhookUrl: response.data[DISCORD_URL_COLUMN] ?? null,
                deliveryPreference: response.data[DELIVERY_PREF_COLUMN] ?? 'Instantly',
            });
        } catch (error: any) {
            console.error("Failed to fetch notification settings:", error);
            toast({ 
                title: "Error Loading Settings", 
                description: error.response?.data?.message || error.message, 
                variant: "destructive" 
            });
            if (telegramState.status !== 'entering_code' && telegramState.status !== 'verifying_code') {
                updateTelegramState(prev => ({
                    ...prev,
                    status: 'error',
                    error: "Could not load Telegram status."
                }));
            }
        }
    }, [token, toast, telegramState.status, updateTelegramState]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Handle Telegram input change
    const handleTelegramInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateTelegramState(prev => ({
            ...prev,
            chatId: e.target.value
        }));
    }, [updateTelegramState]);

    // Handle verification code input change
    const handleVerificationCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        updateTelegramState(prev => ({
            ...prev,
            codeInput: e.target.value
        }));
    }, [updateTelegramState]);

    // Debounced save function
    const debouncedSave = useCallback((newSettings: NotificationSettings) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        if (!settings) {
            console.error('Cannot save settings: current settings are null');
            toast({
                title: "Error Saving Settings",
                description: "Current settings are not loaded. Please refresh the page.",
                variant: "destructive"
            });
            return;
        }
        
        saveTimeoutRef.current = setTimeout(async () => {
            setIsSaving(true);
            try {
                await updateSettings({
                    notificationSettings: {
                        ...settings.notificationSettings,  // Preserve other settings
                        ...newSettings  // Override with new values
                    }
                });
                toast({
                    title: "Settings Saved",
                    description: "Your notification settings have been updated.",
                    variant: "default"
                });
            } catch (error: any) {
                console.error('Failed to save settings:', error);
                toast({
                    title: "Error Saving Settings",
                    description: error.response?.data?.message || "Failed to save your settings. Please try again.",
                    variant: "destructive"
                });
            } finally {
                setIsSaving(false);
            }
        }, 1000); // 1 second debounce
    }, [updateSettings, toast, settings]);

    // Handles Discord and Delivery Pref changes
    const handleOtherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (!localSettings) return;
        
        const newSettings = {
            ...localSettings,
            discordWebhookUrl: name === 'discordWebhookUrl' ? (value || null) : localSettings.discordWebhookUrl,
        };
        
        setLocalSettings(newSettings);
        debouncedSave(newSettings);
    };

    // Handles Delivery Pref changes
    const handleSelectChange = (value: string) => {
        if (!localSettings) return;
        
        const newSettings = {
            ...localSettings,
            deliveryPreference: value,
        };
        
        setLocalSettings(newSettings);
        debouncedSave(newSettings);
    };

    // --- Telegram Connection Logic ---

    // Update the request code handler
    const handleRequestTelegramCode = async (e?: React.FormEvent) => {
        e?.preventDefault(); // Prevent form submission
        if (!token || !telegramState.chatId || telegramState.isConnecting) return;

        try {
            updateTelegramState(prev => ({
                ...prev,
                status: 'requesting_code',
                isConnecting: true,
                error: null
            }));

            const response = await axios.post(
                `${BACKEND_API_BASE_URL}/users/notifications/telegram/request-code`,
                { chatId: telegramState.chatId },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            
            // Store the verification session ID if provided by the backend
            const verificationSession = response.data?.verificationSession;
            
            const newState = {
                status: 'entering_code' as TelegramStatus,
                chatId: telegramState.chatId,
                codeInput: '',
                isConnecting: false,
                error: null,
                verificationSession // Store the session ID
            };
            setStoredTelegramState(newState);
            updateTelegramState(newState);
            
            toast({ 
                title: "Verification Code Sent", 
                description: `Check Telegram for a message from the bot to chat ID ${telegramState.chatId}. Code expires in 5 minutes.`,
                variant: "default"
            });
        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to send verification code.";
            console.error("Telegram code request error:", error.response?.data || error);
            toast({ title: "Request Failed", description: message, variant: "destructive" });
            
            updateTelegramState(prev => ({
                ...prev,
                status: 'entering_chat_id',
                error: message,
                isConnecting: false
            }));
        }
    };

    // Update the verify code handler
    const handleVerifyTelegramCode = async (e?: React.FormEvent) => {
        e?.preventDefault(); // Prevent form submission
        if (!token || !telegramState.chatId || !telegramState.codeInput || telegramState.isConnecting) return;

        try {
            updateTelegramState(prev => ({
                ...prev,
                status: 'verifying_code',
                isConnecting: true,
                error: null
            }));

            const response = await axios.post(
                `${BACKEND_API_BASE_URL}/users/notifications/telegram/verify-code`,
                { 
                    chatId: telegramState.chatId, 
                    code: telegramState.codeInput,
                    verificationSession: telegramState.verificationSession // Send back the session ID
                },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            // Clear verification session from storage
            sessionStorage.removeItem('telegramVerificationState');

            // Update local state to connected
            const connectedState = {
                status: 'connected' as TelegramStatus,
                chatId: telegramState.chatId,
                codeInput: '',
                isConnecting: false,
                error: null
            };
            console.log("[handleVerifyTelegramCode] Setting state to connected:", connectedState);
            updateTelegramState(connectedState);

            // Update global settings (this might trigger the useEffect above)
            if (settings) {
                const updatedSettings = {
                    ...settings,
                    notificationSettings: {
                        ...settings.notificationSettings,
                        telegramChatId: telegramState.chatId
                    }
                };
                updateSettings(updatedSettings);
            }

            toast({ 
                title: "Telegram Connected!", 
                description: response.data?.message || `Successfully connected Telegram chat ID ${telegramState.chatId}.`,
                variant: "default"
            });
        } catch (error: any) {
            const message = error.response?.data?.message || "Verification failed. Code might be incorrect or expired.";
            console.error("Telegram code verification error:", error.response?.data || error);
            toast({ title: "Connection Failed", description: message, variant: "destructive" });
            
            updateTelegramState(prev => ({
                ...prev,
                error: message,
                isConnecting: false,
                status: 'entering_code' // Keep in code entry state on error
            }));
        }
    };
    
    const handleDisconnectTelegram = async () => {
        if (!token || telegramState.isConnecting) return;
        updateTelegramState({ ...telegramState, isConnecting: true, error: null });
        try {
            await axios.delete(
                `${BACKEND_API_BASE_URL}/users/notifications/telegram`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            updateTelegramState({
                ...telegramState,
                status: 'entering_chat_id',
                chatId: '',
                isConnecting: false
            });
            updateSettings({
                notificationSettings: {
                    telegramChatId: null,
                    discordWebhookUrl: settings?.notificationSettings.discordWebhookUrl || null,
                    deliveryPreference: settings?.notificationSettings.deliveryPreference || 'Instantly',
                }
            });
            toast({ title: "Telegram Disconnected", description: "Your Telegram connection has been removed.", variant: "default" });
        } catch (error: any) {
             const message = error.response?.data?.message || "Failed to disconnect Telegram.";
            console.error("Telegram disconnect error:", error.response?.data || error);
            toast({ title: "Disconnect Failed", description: message, variant: "destructive" });
            updateTelegramState({
                ...telegramState,
                status: 'connected',
                isConnecting: false
            });
        }
    };

    // Update the cancel handler
    const handleCancelTelegramConnect = () => {
        sessionStorage.removeItem('telegramVerificationState');
        updateTelegramState({
            status: 'entering_chat_id',
            chatId: '',
            codeInput: '',
            error: null,
            isConnecting: false
        });
    };

    // Go back to entering Chat ID
    const handleBackToEnterChatId = () => {
        updateTelegramState({
            status: 'entering_chat_id',
            chatId: '',
            error: null,
            isConnecting: false,
            codeInput: ''
        });
    };

    // --- Test Notification Handler (Unchanged logic, just ensure TG check is correct) ---
    const handleTestNotification = async (channelType: 'telegram' | 'discord' | 'email') => {
        if (!token || !settings || isTesting) return;
        setIsTesting(channelType);

        try {
            await axios.post(
                `${BACKEND_API_BASE_URL}/users/notifications/test`,
                { channel: channelType },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast({ title: "Test Sent", description: `A test notification has been sent via ${channelType}.` });
        } catch (error: any) {
             const message = error.response?.data?.message || `Failed to send test ${channelType} notification.`;
            toast({ title: "Test Failed", description: message, variant: "destructive" });
            console.error(`${channelType} test error:`, error.response?.data || error);
        } finally {
            setIsTesting(null);
        }
    };

    // Helper to mask chat ID
    const maskChatId = (chatId: string): string => {
        if (!chatId || chatId.length < 4) return chatId;
        return `${chatId.substring(0, 2)}...${chatId.substring(chatId.length - 2)}`;
    }

    // Handle form submissions
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (telegramState.status === 'entering_code') {
            handleVerifyTelegramCode();
        } else {
            handleRequestTelegramCode();
        }
    };

    // Update the chat ID input section
    const renderChatIdInput = () => (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="telegramChatId" className="text-neutral-200">Telegram Chat ID</Label>
                <div className="relative">
                    <Input
                        id="telegramChatId"
                        value={telegramState.chatId}
                        onChange={handleTelegramInputChange}
                        placeholder="Enter your Telegram Chat ID"
                        className="bg-neutral-800 border-neutral-700 text-white pr-24"
                        disabled={telegramState.isConnecting}
                    />
                    <Button
                        type="submit"
                        disabled={!telegramState.chatId || telegramState.isConnecting}
                        className="absolute right-1 top-1 bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 h-8 px-3"
                    >
                        {telegramState.isConnecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <span className="flex items-center gap-1">
                                <KeyRound className="h-4 w-4" />
                                Verify
                            </span>
                        )}
                    </Button>
                </div>
                <p className="text-sm text-neutral-400">
                    Message @TrendyBot on Telegram to get your Chat ID
                </p>
            </div>
        </form>
    );

    // Update the verification code input section
    const renderVerificationCodeInput = () => (
        <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="telegramCode" className="text-neutral-200">Verification Code</Label>
                <div className="relative">
                    <Input
                        id="telegramCode"
                        value={telegramState.codeInput}
                        onChange={handleVerificationCodeChange}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="bg-neutral-800 border-neutral-700 text-white pr-24"
                        disabled={telegramState.status === 'verifying_code' || telegramState.isConnecting}
                    />
                    <Button
                        type="submit"
                        disabled={!telegramState.codeInput || telegramState.codeInput.length !== 6 || telegramState.status === 'verifying_code' || telegramState.isConnecting}
                        className="absolute right-1 top-1 bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 h-8 px-3"
                    >
                        {telegramState.status === 'verifying_code' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <span className="flex items-center gap-1">
                                <CheckCircle className="h-4 w-4" />
                                Verify
                            </span>
                        )}
                    </Button>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-sm text-neutral-400">
                        Check your Telegram for the verification code
                    </p>
                    <Button
                        onClick={handleCancelTelegramConnect}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-neutral-400 hover:text-white"
                        disabled={telegramState.status === 'verifying_code'}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </form>
    );

    if (isSettingsLoading) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6">
                <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-trendy-yellow" />
                    <span className="ml-2 text-neutral-400">Loading settings...</span>
                </div>
            </div>
        );
    }

    // Still need settings guard for Discord/Delivery Prefs access
    if (!settings) return null; // Should be covered by above, but for TS safety

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-4xl">
             <div className="flex justify-between items-center mb-6">
                 <div>
                    <h1 className="text-3xl font-bold text-white font-orbitron">Notification Settings</h1>
                    <p className="text-neutral-400">Manage channels, delivery preferences, and templates for your alerts.</p>
                </div>
                 {/* This button now only saves Discord/Delivery Preferences */}
                 <Button
                    onClick={() => debouncedSave(localSettings || { telegramChatId: null, discordWebhookUrl: null, deliveryPreference: 'Instantly' })}
                    className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                    disabled={isSaving || telegramState.isConnecting}
                    type="button"
                >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Prefs
                </Button>
            </div>

            {/* Use a simple div instead of form as submission is handled by buttons */}
            <div className="space-y-8">
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
                        {/* Email Section (Unchanged) */}
                        <div className="flex items-center justify-between p-4 border border-neutral-700 rounded-md">
                             <div className="space-y-1">
                                <Label className="text-base text-neutral-200">Email</Label>
                                <p className="text-sm text-neutral-400">Notifications will be sent to: {user?.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-green-400 bg-green-900/50 px-2 py-1 rounded-md border border-green-700 flex items-center gap-1"><CheckCircle size={14}/>Connected</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTestNotification('email')}
                                    disabled={isTesting !== null || telegramState.isConnecting}
                                    className="border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80 hover:text-white"
                                >
                                    {isTesting === 'email' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Test
                                </Button>
                            </div>
                        </div>

                        {/* --- Telegram Section (Dynamic UI) --- */}
                        <Card className="bg-neutral-800/50 border-neutral-700/50">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-trendy-yellow" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                                    </svg>
                                    <CardTitle className="text-white font-orbitron">Telegram Settings</CardTitle>
                                </div>
                                <CardDescription className="text-neutral-400 pt-1 pl-7">
                                    Connect your Telegram account to receive notifications.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {telegramState.status === 'connected' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-green-400">
                                                    <CheckCircle className="h-5 w-5" />
                                                    <span className="font-medium">Connected to Telegram</span>
                            </div>
                                    <p className="text-sm text-neutral-400">
                                                    Chat ID: {maskChatId(telegramState.chatId)}
                                                </p>
                                    </div>
                                            <div className="flex items-center gap-2">
                                        <Button
                                                    onClick={() => handleTestNotification('telegram')}
                                                    disabled={isTesting !== null}
                                                    variant="outline"
                                            size="sm"
                                                    className="border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80 hover:text-white"
                                                >
                                                    {isTesting === 'telegram' ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Send className="mr-2 h-4 w-4" />
                                                    )}
                                            Test
                                        </Button>
                                        <Button
                                                    onClick={handleDisconnectTelegram}
                                                    variant="outline"
                                            size="sm"
                                                    className="border-red-700/50 text-red-400 hover:bg-red-900/20 hover:border-red-700"
                                                    disabled={telegramState.isConnecting}
                                                >
                                                    {telegramState.isConnecting ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Unlink className="mr-2 h-4 w-4" />
                                                    )}
                                            Disconnect
                                        </Button>
                                    </div>
                                </div>
                                </div>
                            )}

                                {(telegramState.status === 'initial' || telegramState.status === 'entering_chat_id') && renderChatIdInput()}

                                {(telegramState.status === 'entering_code' || telegramState.status === 'requesting_code' || telegramState.status === 'verifying_code') && renderVerificationCodeInput()}

                                {telegramState.error && (
                                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-md border border-red-500/20">
                                        <XCircle className="h-4 w-4 flex-shrink-0" />
                                        <p>{telegramState.error}</p>
                        </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Discord Section (Input handler updated) */}
                        <div className="p-4 border border-neutral-700 rounded-md space-y-2">
                                <div className="flex items-center justify-between">
                                <Label className="text-base text-neutral-200 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M20.317 4.483A12.12 12.12 0 0 0 12.05 2c-1.82 0-3.53.4-5.086 1.15-.424.213-.806.467-1.14.76-.24.213-.46.448-.654.704-.338.447-.6 .955-.775 1.506C4.13 7.17 4 8.264 4 9.42v6.82c0 1.32.263 2.516.746 3.592.483 1.076 1.18 1.96 2.09 2.652.91.69 2.022 1.166 3.336 1.43a10.07 10.07 0 0 0 3.88.575c.74 0 1.46-.074 2.156-.224a8.89 8.89 0 0 0 3.756-1.781c.894-.69 1.59-1.575 2.075-2.651.484-1.077.746-2.272.746-3.592V9.42c0-1.158-.13-2.25-.39-3.277-.175-.55-.437-1.06-.775-1.507-.193-.256-.414-.49-.654-.703-.335-.293-.717-.547-1.14-.76zm-4.13 8.197c-.654 0-1.18-.53-1.18-1.18s.526-1.18 1.18-1.18c.653 0 1.18.53 1.18 1.18s-.527 1.18-1.18 1.18zm-8.323 0c-.654 0-1.18-.53-1.18-1.18s.526-1.18 1.18-1.18c.653 0 1.18.53 1.18 1.18s-.526 1.18-1.18 1.18z"/></svg> {/* Simple Discord Icon */}
                                    Discord
                                </Label>
                                 {/* Basic check if URL seems valid enough to show 'Connected' style - improve if needed */}
                                {settings?.notificationSettings.discordWebhookUrl && settings?.notificationSettings.discordWebhookUrl.startsWith('https://discord.com/api/webhooks/') ? (
                                    <span className="text-xs font-medium text-green-400 bg-green-900/50 px-2 py-1 rounded-md border border-green-700 flex items-center gap-1"><CheckCircle size={14}/>Setup</span>
                                ) : (
                                    <span className="text-xs font-medium text-neutral-500 bg-neutral-700/50 px-2 py-1 rounded-md border border-neutral-600 flex items-center gap-1"><XCircle size={14}/>Not Setup</span>
                                )}
                            </div>
                            <Label htmlFor="discordWebhookUrl" className="text-sm text-neutral-400">Webhook URL</Label>
                            <Input
                                id="discordWebhookUrl"
                                name="discordWebhookUrl"
                                placeholder="Enter your Discord Webhook URL"
                                value={settings?.notificationSettings.discordWebhookUrl || ''}
                                onChange={handleOtherInputChange}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                disabled={isSaving || telegramState.isConnecting}
                            />
                            <p className="text-xs text-neutral-500">Go to Server Settings &gt; Integrations &gt; Webhooks &gt; New Webhook, then copy the URL.</p>
                                <div className="flex justify-end gap-2 pt-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleTestNotification('discord')}
                                        disabled={!settings?.notificationSettings.discordWebhookUrl || !settings?.notificationSettings.discordWebhookUrl.startsWith('https://discord.com/api/webhooks/') || isTesting !== null || telegramState.isConnecting}
                                        className="border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80 hover:text-white disabled:opacity-50"
                                    >
                                         {isTesting === 'discord' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                        Test
                                    </Button>
                                    {/* Keep this disabled button or remove if no plans for OAuth */}
                                    {/* <Button size="sm" variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Connect (Soon)</Button> */}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 {/* Delivery Preferences Card (Redesigned) */}
                 <Card className="bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-trendy-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z"/>
                                <path d="M12 2v1"/>
                                <path d="M12 6v1"/>
                                <path d="M16.24 7.76l.7-.7"/>
                                <path d="M18 12h1"/>
                                <path d="M5 12h1"/>
                                <path d="M7.06 7.06l.7.7"/>
                                <rect x="6" y="16" width="12" height="4" rx="1"/>
                            </svg>
                        <CardTitle className="text-white font-orbitron">Delivery Preferences</CardTitle>
                        </div>
                        <CardDescription className="text-neutral-400 pt-1 pl-7">
                            Choose how and when you want to receive notifications for different types of alerts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* General Delivery Preference */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base text-neutral-200">Default Delivery Schedule</Label>
                                {isSaving && (
                                    <span className="text-xs text-neutral-400 flex items-center">
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin"/>
                                        Saving...
                                    </span>
                                )}
                            </div>
                            <Select
                                value={settings?.notificationSettings.deliveryPreference}
                                onValueChange={handleSelectChange}
                                disabled={isSaving || telegramState.isConnecting}
                            >
                                <SelectTrigger className="w-full bg-neutral-700/60 border-neutral-600 text-white focus:ring-trendy-yellow disabled:opacity-70">
                                    <SelectValue placeholder="Select delivery schedule" />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                                    <SelectItem value="Instantly" className="focus:bg-neutral-700 focus:text-white">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                                            </svg>
                                            Instantly (Recommended)
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="Hourly" className="focus:bg-neutral-700 focus:text-white">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"/>
                                                <polyline points="12 6 12 12 16 14"/>
                                            </svg>
                                            Hourly Digest
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="Daily" className="focus:bg-neutral-700 focus:text-white">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                                <line x1="16" y1="2" x2="16" y2="6"/>
                                                <line x1="8" y1="2" x2="8" y2="6"/>
                                                <line x1="3" y1="10" x2="21" y2="10"/>
                                            </svg>
                                            Daily Digest
                                        </div>
                                    </SelectItem>
                            </SelectContent>
                        </Select>
                            <div className="text-sm text-neutral-400 space-y-2">
                                {settings?.notificationSettings.deliveryPreference === 'Instantly' && (
                                    <p className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-trendy-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                                        </svg>
                                        Receive notifications immediately as events occur
                                    </p>
                                )}
                                {settings?.notificationSettings.deliveryPreference === 'Hourly' && (
                                    <p className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-trendy-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"/>
                                            <polyline points="12 6 12 12 16 14"/>
                                        </svg>
                                        Receive a summary of notifications every hour
                                    </p>
                                )}
                                {settings?.notificationSettings.deliveryPreference === 'Daily' && (
                                    <p className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-trendy-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        Receive a daily digest of all notifications
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Quiet Hours (Coming Soon) */}
                        <div className="space-y-2 opacity-60">
                            <Label className="text-base text-neutral-200 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                                    <path d="M12 6v6l4 2"/>
                                </svg>
                                Quiet Hours
                                <span className="text-xs text-trendy-yellow bg-trendy-yellow/10 px-2 py-0.5 rounded-full">Coming Soon</span>
                            </Label>
                            <p className="text-sm text-neutral-400">Set specific hours when you don't want to receive notifications.</p>
                        </div>

                        {/* Priority Settings (Coming Soon) */}
                        <div className="space-y-2 opacity-60">
                            <Label className="text-base text-neutral-200 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                    <polyline points="22 4 12 14.01 9 11.01"/>
                                </svg>
                                Priority Settings
                                <span className="text-xs text-trendy-yellow bg-trendy-yellow/10 px-2 py-0.5 rounded-full">Coming Soon</span>
                            </Label>
                            <p className="text-sm text-neutral-400">Customize notification priority levels for different types of alerts.</p>
                        </div>
                    </CardContent>
                </Card>

                 {/* No longer need a form submit */}
                {/* <button type="submit" className="hidden">Submit</button> */}
            </div>
        </div>
    );
};

export default NotificationSettings;