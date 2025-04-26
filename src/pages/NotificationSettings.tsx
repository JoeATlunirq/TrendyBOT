import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, BellRing, Send, CheckCircle, XCircle, KeyRound, Link as LinkIcon, Unlink, Mail, BotMessageSquare, MessageSquareWarning } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

// Determine the base API URL based on the environment
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api'; // Use relative path for Vercel production
  } else {
    // Use local backend URL for development
    return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';
  }
};
const BACKEND_API_BASE_URL = getApiBaseUrl();
const API_BASE_URL = BACKEND_API_BASE_URL;

// --- Types --- 

// Combined State for Notification Settings
type NotificationSettingsData = {
    // Values
    notificationEmail: string | null; // Separate notification email (optional?)
    telegramChatId: string | null;
    discordUserId: string | null; // Use discordUserId
    deliveryPreference: string;
    // Verification Statuses
    emailVerified: boolean;
    telegramVerified: boolean;
    discordVerified: boolean;
};

// State for each verification flow
type VerificationFlowStatus = 'initial' | 'code_sent' | 'verifying' | 'verified' | 'error';

type VerificationFlowState = {
    status: VerificationFlowStatus;
    inputValue: string; // For ChatID or Webhook URL
    codeInput: string;
    isLoading: boolean;
    error: string | null;
};

// --- Constants --- 
const EMAIL_COLUMN = import.meta.env.VITE_EMAIL_COLUMN || 'Emails'; // Primary email column

// --- Component --- 

const NotificationSettings = () => {
    const { user, token } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true); // Overall loading state
    const [isSaving, setIsSaving] = useState(false); // For non-verification saves (like delivery pref)
    const [isTesting, setIsTesting] = useState<string | null>(null); // For test notifications

    // State for the actual setting values
    const [settingsData, setSettingsData] = useState<NotificationSettingsData | null>(null);

    // State for verification flows
    const [emailVerification, setEmailVerification] = useState<VerificationFlowState>({
        status: 'initial', inputValue: '', codeInput: '', isLoading: false, error: null
    });
    const [telegramVerification, setTelegramVerification] = useState<VerificationFlowState>({
        status: 'initial', inputValue: '', codeInput: '', isLoading: false, error: null
    });
    const [discordVerification, setDiscordVerification] = useState<VerificationFlowState>({
        status: 'initial', inputValue: '', codeInput: '', isLoading: false, error: null
    });

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Fetch Initial Settings --- 
    const fetchSettings = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/users/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = response.data;
            setSettingsData({
                notificationEmail: data.notificationEmail ?? null, // Use fetched notification email
                telegramChatId: data.telegramChatId ?? null,
                discordUserId: data.discordUserId ?? null, // Use discordUserId
                deliveryPreference: data.deliveryPreference ?? 'Instantly',
                emailVerified: data.emailVerified ?? false,
                telegramVerified: data.telegramVerified ?? false,
                discordVerified: data.discordVerified ?? false,
            });

            // Update verification flow states based on fetched data
            setEmailVerification(prev => ({
                 ...prev,
                status: data.emailVerified ? 'verified' : 'initial',
                inputValue: data.notificationEmail || user?.[EMAIL_COLUMN] || '' // Use fetched notification email, fallback to primary
            }));
            setTelegramVerification(prev => ({
                 ...prev, 
                 status: data.telegramVerified ? 'verified' : 'initial', 
                 inputValue: data.telegramChatId || '' 
            }));
            setDiscordVerification(prev => ({
                 ...prev, 
                 status: data.discordVerified ? 'verified' : 'initial', 
                 inputValue: data.discordUserId || '' // Use discordUserId for input value
            }));

        } catch (error: any) {
            console.error("Failed to fetch notification settings:", error);
            toast({ 
                title: "Error Loading Settings", 
                description: error.response?.data?.message || error.message, 
                variant: "destructive" 
            });
            // Set error states for verification flows?
        } finally {
            setIsLoading(false);
        }
    }, [token, toast, user]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // --- Generic Handlers --- 

    // Handle Verification Input Change
    const handleVerificationInputChange = (
        type: 'email' | 'telegram' | 'discord',
        field: 'inputValue' | 'codeInput',
        value: string
    ) => {
        const setState = type === 'email' ? setEmailVerification :
                         type === 'telegram' ? setTelegramVerification :
                         setDiscordVerification;
        setState(prev => ({ ...prev, [field]: value, error: null }));
    };

    // Send Verification Code
    const handleSendCode = async (type: 'email' | 'telegram' | 'discord') => {
        const flowState = type === 'email' ? emailVerification :
                          type === 'telegram' ? telegramVerification :
                          discordVerification;
        const setState = type === 'email' ? setEmailVerification :
                         type === 'telegram' ? setTelegramVerification :
                         setDiscordVerification;
        
        let endpoint = `${API_BASE_URL}/users/${type}/send-code`;
        let payload = {};
        let inputToCheck = flowState.inputValue;

        if (type === 'telegram') {
            if (!inputToCheck || !/^-?\d+$/.test(inputToCheck)) {
                toast({ title: "Invalid Input", description: "Please enter a valid Telegram Chat ID.", variant: "destructive" });
                return;
            }
            payload = { chatId: String(inputToCheck) };
        } else if (type === 'discord') {
             if (!inputToCheck || !/^\d+$/.test(inputToCheck)) {
                toast({ title: "Invalid Input", description: "Please enter a valid Discord User ID.", variant: "destructive" });
            return;
            }
            // No payload needed for Discord send-code, backend uses stored ID
        } else { // Email
            // No payload needed for email
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const response = await axios.post(endpoint, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setState(prev => ({ ...prev, status: 'code_sent', isLoading: false, codeInput: '', error: null }));
            toast({ title: "Code Sent", description: response.data.message, variant: "default" });
            } catch (error: any) {
            const message = error.response?.data?.message || `Failed to send ${type} verification code.`;
            setState(prev => ({ ...prev, isLoading: false, error: message }));
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    };

    // Verify Code
    const handleVerifyCode = async (type: 'email' | 'telegram' | 'discord') => {
        const flowState = type === 'email' ? emailVerification :
                          type === 'telegram' ? telegramVerification :
                          discordVerification;
        const setState = type === 'email' ? setEmailVerification :
                         type === 'telegram' ? setTelegramVerification :
                         setDiscordVerification;

        if (!flowState.codeInput || !/\d{6}/.test(flowState.codeInput)) {
            toast({ title: "Invalid Code", description: "Please enter the 6-digit code.", variant: "destructive" });
             return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null, status: 'verifying' }));
        try {
            const endpoint = `${API_BASE_URL}/users/${type}/verify-code`;
            const response = await axios.post(endpoint, { verificationCode: flowState.codeInput }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setState(prev => ({
                ...prev,
                status: 'verified',
                isLoading: false,
                error: null,
                codeInput: '' // Clear code input on success
            }));
            // Update the main settings data to reflect verification
            setSettingsData(prev => prev ? { ...prev, [`${type}Verified`]: true } : null);
            toast({ title: "Success", description: response.data.message, variant: "default" });
        } catch (error: any) {
            const message = error.response?.data?.message || `Failed to verify ${type} code.`;
            // Revert status back to code_sent on error so user can retry
            setState(prev => ({ ...prev, isLoading: false, error: message, status: 'code_sent' }));
            toast({ title: "Verification Failed", description: message, variant: "destructive" });
        }
    };

    // Disconnect Channel
    const handleDisconnect = async (type: 'email' | 'telegram' | 'discord') => {
        const setState = type === 'email' ? setEmailVerification :
                         type === 'telegram' ? setTelegramVerification :
                         setDiscordVerification;
        
        // Optional: Confirmation dialog
        if (!window.confirm(`Are you sure you want to disconnect your ${type} notification channel?`)) {
             return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));
        try {
            const endpoint = `${API_BASE_URL}/users/${type}/disconnect`;
            const response = await axios.post(endpoint, {}, { // No body needed
                headers: { 'Authorization': `Bearer ${token}` }
            });
             setState({
                status: 'initial',
                inputValue: type === 'email' ? (user?.[EMAIL_COLUMN] || '') : '', // Reset input
                codeInput: '',
                isLoading: false,
                error: null
            });
            // Update main settings data
            setSettingsData(prev => prev ? { ...prev, [`${type}Verified`]: false, [type === 'telegram' ? 'telegramChatId' : type === 'discord' ? 'discordUserId' : 'notificationEmail']: null } : null);
             toast({ title: "Disconnected", description: response.data.message, variant: "default" });
        } catch (error: any) {
            const message = error.response?.data?.message || `Failed to disconnect ${type}.`;
            setState(prev => ({ ...prev, isLoading: false, error: message })); // Keep status as 'verified' on disconnect failure
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    };

    // Handle Delivery Preference Change (simplified, uses direct API call now)
    const handleDeliveryPreferenceChange = async (value: string) => {
        if (!token) return;
        const previousValue = settingsData?.deliveryPreference;
        // Optimistically update UI
        setSettingsData(prev => prev ? { ...prev, deliveryPreference: value } : null);
        setIsSaving(true); 
        try {
            await axios.put(`${API_BASE_URL}/users/notifications`, 
                { deliveryPreference: value }, 
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            toast({ title: "Preference Updated", variant: "default" });
        } catch (error: any) {
             console.error("Failed to save delivery preference:", error);
             toast({ title: "Save Error", description: error.response?.data?.message || "Could not save preference.", variant: "destructive" });
             // Revert UI on error
             setSettingsData(prev => prev ? { ...prev, deliveryPreference: previousValue || 'Instantly' } : null);
        } finally {
            setIsSaving(false);
        }
    };
    
    // Handle Discord User ID Input Change (Save immediately)
    const handleDiscordInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(`[handleDiscordInputChange] Input changed. Event value: ${e.target.value}`);
        
        if (!token) return;
        const value = e.target.value.replace(/\D/g, ''); // Allow only digits for User ID
        const previousValue = settingsData?.discordUserId;

        // Update local state immediately
        setDiscordVerification(prev => ({ ...prev, inputValue: value, error: null }));
        setSettingsData(prev => prev ? { ...prev, discordUserId: value || null } : null);
        
        // Don't save if verified - user must disconnect first
        if (discordVerification.status === 'verified') return;
        
        // Save immediately via API
        setIsSaving(true); 
        try {
            console.log(`[handleDiscordInputChange] Sending discordUserId to backend: ${value}`);
            
            const response = await axios.put(`${API_BASE_URL}/users/notifications`, 
                { discordUserId: value || null }, // Send discordUserId
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            // Backend resets verification status on ID change
            setDiscordVerification(prev => ({ ...prev, status: 'initial' })); 
            setSettingsData(prev => prev ? { ...prev, discordVerified: false } : null);
            toast({ title: "Discord User ID Saved", description: "Verification status reset.", variant: "default" });
        } catch (error: any) { 
             console.error("Failed to save Discord User ID:", error);
             toast({ title: "Save Error", description: error.response?.data?.message || "Could not save Discord User ID.", variant: "destructive" });
             // Revert UI state on error
             setDiscordVerification(prev => ({ ...prev, inputValue: previousValue || '' }));
             setSettingsData(prev => prev ? { ...prev, discordUserId: previousValue || null } : null);
        } finally {
            setIsSaving(false);
        }
    };

    // Test Notification Handler (reuse existing)
    const handleTestNotification = async (channelType: 'telegram' | 'discord' | 'email') => {
        if (!token) return;
        setIsTesting(channelType);
        try {
            const response = await axios.post(
                `${BACKEND_API_BASE_URL}/users/notifications/test`,
                { channelType },
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
            toast({
                title: `Test Sent (${channelType})`,
                description: response.data.message,
                variant: "default"
            });
        } catch (error: any) {
            toast({
                title: `Test Failed (${channelType})`,
                description: error.response?.data?.message || "Could not send test notification.",
                variant: "destructive"
            });
            console.error(`Test Notification Error (${channelType}):`, error.response?.data || error);
        } finally {
            setIsTesting(null);
        }
    };

    // --- NEW: Handler for Email Input Change (Save immediately) ---
    const handleEmailInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!token) return;
        const value = e.target.value;
        const previousValue = settingsData?.notificationEmail;

        // Update local state immediately
        setEmailVerification(prev => ({ ...prev, inputValue: value, error: null }));
        setSettingsData(prev => prev ? { ...prev, notificationEmail: value || null } : null);
        
        // Don't save if verified - user must disconnect first
        if (emailVerification.status === 'verified') return;
        
        // Save immediately via API
        setIsSaving(true); // Use a general saving indicator if needed
        try {
            // Call the endpoint that handles updating notification settings
            const response = await axios.put(`${API_BASE_URL}/users/notifications`, 
                { notificationEmail: value || null }, // Send the new email
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            // Backend should have marked email as unverified upon change.
            // We need to refresh the state to reflect this.
            // Option 1: Refetch all settings (simpler)
            // fetchSettings(); 
            // Option 2: Update local state based on assumption or response (if backend confirms)
            setEmailVerification(prev => ({ ...prev, status: 'initial' })); // Assume unverified now
            setSettingsData(prev => prev ? { ...prev, emailVerified: false } : null);
            toast({ title: "Notification Email Saved", description: "Verification status reset.", variant: "default" });

        } catch (error: any) { 
             console.error("Failed to save notification email:", error);
             toast({ title: "Save Error", description: error.response?.data?.message || "Could not save email address.", variant: "destructive" });
             // Revert UI state on error
             setEmailVerification(prev => ({ ...prev, inputValue: previousValue || '' }));
             setSettingsData(prev => prev ? { ...prev, notificationEmail: previousValue || null } : null);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render Helper --- 
    const renderVerificationSection = (
        type: 'email' | 'telegram' | 'discord',
        title: string,
        description: string,
        icon: React.ReactNode,
        inputLabel: string,
        inputPlaceholder: string,
        inputType: 'email' | 'text' | 'url' = 'text',
        inputDisabled: boolean = false,
        extraInfo?: React.ReactNode
    ) => {
        const flowState = type === 'email' ? emailVerification :
                          type === 'telegram' ? telegramVerification :
                          discordVerification;
        const isVerified = flowState.status === 'verified';

        return (
            <div className="p-4 border border-neutral-700 rounded-md space-y-4">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-3">
                        <div className="text-neutral-400 mt-1">{icon}</div>
                        <div>
                            <div className="text-neutral-200 font-medium flex items-center flex-wrap gap-2">
                                {title}
                                {isVerified && (
                                    <Badge variant="outline" className="border-green-500/70 bg-green-900/30 text-green-300 text-xs px-1.5 py-0">
                                        <CheckCircle className="h-3 w-3 mr-1" /> Verified
                                    </Badge>
                                )}
                                {flowState.status === 'code_sent' && (
                                     <Badge variant="outline" className="border-yellow-500/70 bg-yellow-900/30 text-yellow-300 text-xs px-1.5 py-0">
                                         <KeyRound className="h-3 w-3 mr-1" /> Pending Verification
                                     </Badge>
                                )}
                                 {flowState.status === 'initial' && !flowState.isLoading && settingsData && !settingsData[`${type}Verified`] && (
                                      <Badge variant="outline" className="border-neutral-600 bg-neutral-700/40 text-neutral-400 text-xs px-1.5 py-0">
                                         Not Verified
                                     </Badge>
                                 )}
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
                        </div>
                    </div>
                    {isVerified && (
                    <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnect(type)}
                            disabled={flowState.isLoading}
                            className="text-xs h-7 px-2 bg-red-800/80 hover:bg-red-700/90"
                        >
                            {flowState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-3 w-3" />}
                            <span className="ml-1.5">Disconnect</span>
                        </Button>
                    )}
                </div>

                {/* Input section - show unless verified */} 
                {!isVerified && (
                    <div className="space-y-3 pt-3 border-t border-neutral-700/50">
                        <div>
                            <Label htmlFor={`${type}-input`} className="text-neutral-300 text-xs">{inputLabel}</Label>
                            <Input
                                id={`${type}-input`}
                                type={inputType}
                                value={flowState.inputValue}
                                placeholder={inputPlaceholder}
                                // Use specific handlers
                                onChange={type === 'email' ? handleEmailInputChange :
                                          type === 'discord' ? handleDiscordInputChange : // Use updated handler
                                          (e) => handleVerificationInputChange(type, 'inputValue', e.target.value)}
                                disabled={flowState.isLoading || (type === 'email' ? false : inputDisabled)}
                                className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-sm"
                            />
                             {extraInfo && <div className="mt-1.5">{extraInfo}</div>}
            </div>

                        {/* Show Send Code / Verification Input */} 
                        {flowState.status === 'code_sent' || flowState.status === 'verifying' ? (
                            <div className="space-y-3">
                                 <div className="space-y-1.5">
                                     <Label htmlFor={`${type}-code-input`} className="text-neutral-300 text-xs">Verification Code</Label>
                    <Input
                                         id={`${type}-code-input`}
                                         type="text"
                                         inputMode="numeric"
                                         pattern="\d{6}"
                        maxLength={6}
                                         value={flowState.codeInput}
                                         onChange={(e) => handleVerificationInputChange(type, 'codeInput', e.target.value.replace(/\D/g, ''))}
                                         placeholder="6-digit code"
                                         required
                                         disabled={flowState.isLoading}
                                         className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow text-sm w-32"
                                     />
                                 </div>
                                <div className="flex justify-between items-center gap-3">
                                    <Button 
                                        type="button"
                                        onClick={() => handleVerifyCode(type)}
                                        disabled={flowState.isLoading || flowState.codeInput.length !== 6}
                                        size="sm"
                                        className="text-xs h-8 bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                                    >
                                        {flowState.isLoading && flowState.status === 'verifying' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5"/>}
                                        Verify Code
                                    </Button>
                    <Button
                                        variant="ghost"
                                        type="button" 
                                        onClick={() => handleSendCode(type)} // Resend code
                                        disabled={flowState.isLoading}
                                        className="text-neutral-400 hover:text-trendy-yellow text-xs h-8 px-2"
                                    >
                                         {flowState.isLoading && flowState.status !== 'verifying' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3"/>}
                                        Resend Code
                                    </Button>
                                </div>
                           </div>
                        ) : (
                            <Button 
                                type="button"
                                onClick={() => handleSendCode(type)}
                                // Update disabled check for discord (ensure ID is present)
                                disabled={!flowState.inputValue || flowState.isLoading || (type === 'discord' && !/\d+/.test(flowState.inputValue))}
                                size="sm"
                                className="text-xs h-8 bg-neutral-600 hover:bg-neutral-500 text-white"
                            >
                                {flowState.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5"/>}
                                Send Verification Code
                            </Button>
                        )}
                        {flowState.error && <p className="text-xs text-red-400">Error: {flowState.error}</p>}
                </div>
                )}
                
                {/* Test Button - Only show if verified */} 
                {isVerified && (
                    <div className="pt-3 border-t border-neutral-700/50">
                    <Button
                             variant="outline" 
                        size="sm"
                             onClick={() => handleTestNotification(type)}
                             disabled={isTesting === type}
                             className="text-xs h-7 px-2 border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80"
                    >
                            {isTesting === type ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <BellRing className="mr-1.5 h-3 w-3"/>}
                             Send Test Notification
                    </Button>
                </div>
                )}
            </div>
    );
    };

    // --- Render Component --- 

    if (isLoading || !settingsData) {
        return (
            <div className="container mx-auto py-8 px-4 md:px-6 max-w-3xl flex justify-center items-center min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-3xl">
            <h1 className="text-3xl font-bold mb-2 text-white font-orbitron">Notification Settings</h1>
            <p className="text-neutral-400 mb-6">Connect your preferred channels and choose how you receive alerts.</p>

            <Card className="mb-6 bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                    <CardTitle className="text-white font-orbitron">Connected Channels</CardTitle>
                    <CardDescription className="text-neutral-400">Verify your channels to receive alerts.</CardDescription>
                    </CardHeader>
                <CardContent className="space-y-5">
                    {/* Email Verification Section */} 
                     {renderVerificationSection(
                        'email',
                        'Email',
                        "Enter the email address where you want to receive notifications.",
                        <Mail className="h-5 w-5" />,
                        'Notification Email',
                        'your-notification-email@example.com',
                        'email',
                        false // Input is NOT disabled anymore
                    )}
                    
                    {/* Telegram Verification Section */} 
                    {renderVerificationSection(
                        'telegram',
                        'Telegram',
                        'Connect your Telegram account via Chat ID.',
                        <Send className="h-5 w-5" />,
                        'Your Telegram Chat ID',
                        'e.g., -100123456789 or 123456789',
                        'text',
                        false,
                        <p className="text-xs text-neutral-500">
                            Need help finding your Chat ID? Talk to <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="underline text-trendy-yellow/80 hover:text-trendy-yellow">@userinfobot</a> on Telegram.
                        </p>
                    )}
                    
                    {/* Discord Verification Section - MODIFIED */} 
                    {renderVerificationSection(
                        'discord',
                        'Discord',
                        'Connect your Discord account via User ID to receive DMs.', // Updated desc
                        <BotMessageSquare className="h-5 w-5" />,
                        'Your Discord User ID', // Updated label
                        'e.g., 123456789012345678', // Updated placeholder
                        'text', // Change input type maybe?
                        false,
                         <p className="text-xs text-neutral-500 flex items-start gap-1.5">
                            <MessageSquareWarning className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0 mt-px" />
                           <span>You can find your User ID in Discord's settings (User Settings -&gt; Advanced -&gt; Enable Developer Mode, then right-click your profile and 'Copy User ID'). Verification codes will be sent via DM from the bot.</span>
                         </p>
                                )}
                            </CardContent>
                        </Card>

             <Card className="mb-6 bg-neutral-800/50 border-neutral-700/50">
                    <CardHeader>
                    <CardTitle className="text-white font-orbitron">Delivery Preference</CardTitle>
                    <CardDescription className="text-neutral-400">Choose how quickly you want to receive alerts after a trend is detected.</CardDescription>
                    </CardHeader>
                 <CardContent>
                            <Select
                          value={settingsData.deliveryPreference}
                          onValueChange={handleDeliveryPreferenceChange} // Use direct save handler
                          disabled={isSaving}
                      >
                          <SelectTrigger className="w-full sm:w-[280px] bg-neutral-700/60 border-neutral-600 text-white">
                             <SelectValue placeholder="Select delivery speed" />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-800 border-neutral-700 text-neutral-200">
                              <SelectItem value="Instantly" className="focus:bg-neutral-700 focus:text-white">Instantly (Recommended)</SelectItem>
                              <SelectItem value="Hourly Digest" className="focus:bg-neutral-700 focus:text-white">Hourly Digest</SelectItem>
                              <SelectItem value="Daily Digest" className="focus:bg-neutral-700 focus:text-white">Daily Digest</SelectItem>
                            </SelectContent>
                        </Select>
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin ml-2 inline-block text-neutral-400"/>}
                    </CardContent>
                </Card>

        </div>
    );
};

export default NotificationSettings;