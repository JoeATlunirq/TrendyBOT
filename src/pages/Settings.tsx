import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Copy, CheckIcon, Star, Check } from 'lucide-react';
import { QRCodeCanvas } from "qrcode.react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { format, isFuture } from 'date-fns';

// Determine the base API URL based on the environment
const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '/api'; // Use relative path for Vercel production
  } else {
    // Use local backend URL for development (allow override via .env)
    return import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5001/api';
  }
};
const BACKEND_API_BASE_URL = getApiBaseUrl();

// Constants for NocoDB column names (ensure these match .env and NocoDB)
const NAME_COLUMN = import.meta.env.VITE_NAME_COLUMN || 'Names';
const EMAIL_COLUMN = import.meta.env.VITE_EMAIL_COLUMN || 'Emails';
const COMPANY_COLUMN = import.meta.env.VITE_COMPANY_COLUMN || 'company_name';
const PROFILE_PHOTO_URL_COLUMN = import.meta.env.VITE_PROFILE_PHOTO_URL_COLUMN || 'profile_photo_url';
const TWO_FACTOR_ENABLED_COLUMN = import.meta.env.VITE_2FA_ENABLED_COLUMN || 'is_two_factor_enabled';

// Notification Column Names (Ensure these match backend .env and NocoDB)
const TELEGRAM_ID_COLUMN = 'telegram_chat_id';
const DISCORD_URL_COLUMN = 'discord_webhook_url';
const DELIVERY_PREF_COLUMN = 'delivery_preference';

// Helper function to get initial tab from hash
const getInitialTab = (): string => {
    const hash = window.location.hash.replace('#', '');
    return (hash === 'account') ? hash : 'account';
};

const API_BASE_URL = BACKEND_API_BASE_URL; // Added for consistency

const Settings = () => {
    // Pass updateUserContext from useAuth
    const { user, token, logout, updateUserContext, isTwoFactorEnabled, isLoading } = useAuth(); 
    const { toast } = useToast();
    const navigate = useNavigate();
    const [profileName, setProfileName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    const [isPhotoUploading, setIsPhotoUploading] = useState(false);
    const [isPasswordChanging, setIsPasswordChanging] = useState(false);
    const [isEnabling2FA, setIsEnabling2FA] = useState(false);
    const [isDisabling2FA, setIsDisabling2FA] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    // Password Change State
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    // 2FA State
    const [show2FASetup, setShow2FASetup] = useState(false);
    const [twoFASecret, setTwoFASecret] = useState<string | null>(null);
    const [twoFAOtpUri, setTwoFAOtpUri] = useState<string | null>(null);
    const [twoFAVerificationCode, setTwoFAVerificationCode] = useState('');
    const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);
    const [secretCopied, setSecretCopied] = useState(false);
    const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null); // State for signed URL
    const [isFetchingAvatarUrl, setIsFetchingAvatarUrl] = useState(false); // Loading state
    const [avatarCacheBuster, setAvatarCacheBuster] = useState<string>(""); // NEW: Cache buster state

    // Ref for hidden file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Initialize State for Active Tab directly from hash --- 
    const [activeTab, setActiveTab] = useState<string>(getInitialTab()); 

    // Function to generate fallback avatar URL
    const generateFallbackAvatar = (name: string | undefined, email: string | undefined) => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || email || 'User')}&background=404040&color=e5e5e5&bold=true`;
    };

    // --- Fetch Signed URL Function (extracted) ---
    const fetchAvatarUrl = useCallback(async () => {
        if (!token) {
            setAvatarSignedUrl(null); 
            return;
        }
        setIsFetchingAvatarUrl(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/users/avatar-url`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setAvatarSignedUrl(response.data?.signedUrl || null); // Use null if no URL
            if (response.data?.signedUrl) {
                setAvatarCacheBuster(`?t=${new Date().getTime()}`); // Set cache buster on successful fetch
            }
        } catch (error) {
            console.error("Error fetching avatar signed URL:", error);
            setAvatarSignedUrl(null); 
        } finally {
            setIsFetchingAvatarUrl(false);
        }
    }, [token]); // Depends only on token

    // --- Fetch Signed URL on Mount/Token Change ---
    useEffect(() => {
        fetchAvatarUrl();
    }, [fetchAvatarUrl]); // Run when fetchAvatarUrl function reference changes (which is stable due to useCallback)

    useEffect(() => {
        if (user) {
            setProfileName(user[NAME_COLUMN] || '');
            setCompanyName(user[COMPANY_COLUMN] || '');
            // Fetch avatar URL when user context loads/changes as well
            // fetchAvatarUrl(); // Re-fetching based on user might cause loops if user updates frequently
        } 
    }, [user]); // Removed fetchAvatarUrl from here

    // --- Update Profile Handler - Also use updateUserContext ---
    const handleProfileUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!token || !user) return;

        const updatedFields: Record<string, any> = {};
        if (profileName !== user[NAME_COLUMN]) {
            updatedFields[NAME_COLUMN] = profileName;
        }
        if (companyName !== user[COMPANY_COLUMN]) {
            updatedFields[COMPANY_COLUMN] = companyName;
        }

        if (Object.keys(updatedFields).length === 0) {
            toast({ title: "No Changes", description: "Profile information is already up to date.", variant: "default" });
            return;
        }

        try {
            const response = await axios.put(
                `${API_BASE_URL}/users/profile`,
                updatedFields,
                { headers: { 'Authorization': `Bearer ${token}` }}
            );

            toast({ title: "Profile Updated", description: response.data?.message || "Your profile has been saved." });
            
            // Update context immediately with the changes sent
            // Keep this call for name/company updates
            updateUserContext(updatedFields); 
            
            // Note: Backend response might contain the full updated user object,
            // which could be used for a more robust update, but this works for now.

        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast({ title: "Update Error", description: error.response?.data?.message || "Failed to update profile.", variant: "destructive" });
        }
    };

    // --- Placeholder Handlers ---
    const handleChangePhotoClick = () => {
        // Trigger the hidden file input
        fileInputRef.current?.click();
    };

    // --- Handle File Selection and Upload (MODIFIED SUCCESS) ---
    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !token) return;

        // Optional: Client-side validation (example)
        if (!file.type.startsWith('image/')) {
            toast({ title: "Invalid File Type", description: "Please select an image file.", variant: "destructive" });
            return;
        }
        if (file.size > 2 * 1024 * 1024) { // 2MB limit matches backend
            toast({ title: "File Too Large", description: "Please select an image file smaller than 2MB.", variant: "destructive" });
            return;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        setIsPhotoUploading(true);
        try {
            const response = await axios.put(
                `${API_BASE_URL}/users/profile/photo`,
                formData,
                { headers: { 'Authorization': `Bearer ${token}` }}
            );

            // --- MODIFIED SUCCESS HANDLING ---
            if (response.data?.photoPath) { // Check for photoPath from backend
                toast({ title: "Photo Uploaded", description: response.data.message || "Processing complete." });
                
                setAvatarSignedUrl(null); // Clear old one immediately
                setAvatarCacheBuster("");   // Clear old buster immediately

                if (response.data.signedUrl) { // Prefer direct signed URL from upload response
                    setAvatarSignedUrl(response.data.signedUrl);
                    setAvatarCacheBuster(`?t=${new Date().getTime()}`);
                    updateUserContext({ profilePictureUpdated: new Date().getTime() }); // More specific context update
                } else {
                    // Fallback if backend doesn't yet return signedUrl directly from upload
                    console.warn("[Settings] Photo upload response did not include a direct signedUrl. Falling back to fetchAvatarUrl() after a short delay. Consider updating backend to return signedUrl from photo upload.");
                    setTimeout(async () => {
                        await fetchAvatarUrl(); // This will set signedUrl and cacheBuster via its own logic
                        updateUserContext({ profilePictureUpdated: new Date().getTime() }); // More specific context update
                    }, 1500); // Delay of 1.5 seconds
                }
            } else {
                throw new Error("Invalid response from server during photo upload (missing photoPath).");
            }
            // --- END MODIFIED HANDLING ---

        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to upload photo.";
            toast({ title: "Upload Failed", description: message, variant: "destructive" });
            console.error("Photo upload error:", error.response?.data || error);
        } finally {
            setIsPhotoUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleChangePasswordClick = () => {
        setShowPasswordForm(true); // Show the form
    };

    // --- Handle Password Form Submission ---
    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token) return;

        // Basic Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast({ title: "Missing Fields", description: "Please fill in all password fields.", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "Passwords Don't Match", description: "The new password and confirmation do not match.", variant: "destructive" });
            return;
        }
        if (newPassword.length < 8) { // Example complexity rule
            toast({ title: "Password Too Short", description: "New password must be at least 8 characters.", variant: "destructive" });
            return;
        }

        setIsPasswordChanging(true);

        try {
            const response = await axios.post(
                `${BACKEND_API_BASE_URL}/users/change-password`, 
                { currentPassword, newPassword }, // Send current and new
                { headers: { 'Authorization': `Bearer ${token}` }}
            );

            toast({ title: "Password Updated", description: response.data?.message || "Your password has been changed successfully." });
            // Clear fields and hide form on success
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordForm(false);

        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to change password.";
            toast({ title: "Update Failed", description: message, variant: "destructive" });
            console.error("Password change error:", error.response?.data || error);
        } finally {
            setIsPasswordChanging(false);
        }
    };

    // --- Handle 2FA Setup Click ---
    const handleEnable2FAClick = async () => {
        if (!token) return;
        setIsEnabling2FA(true);
        setShow2FASetup(true); // Show the section immediately
        setTwoFASecret(null); // Clear previous state
        setTwoFAOtpUri(null);
        setTwoFAVerificationCode('');

        try {
            const response = await axios.get(
                `${BACKEND_API_BASE_URL}/users/2fa/setup`, 
                { headers: { 'Authorization': `Bearer ${token}` }}
            );
            setTwoFASecret(response.data.secret);
            setTwoFAOtpUri(response.data.otpauthUri);
        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to start 2FA setup.";
            toast({ title: "Error", description: message, variant: "destructive" });
            setShow2FASetup(false); // Hide setup on error
        } finally {
            setIsEnabling2FA(false);
        }
    };

    // --- Handle 2FA Verification Submission ---
    const handle2FAVerificationSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token || !twoFAVerificationCode) return;

        if (!/\d{6}/.test(twoFAVerificationCode)) {
             toast({ title: "Invalid Code", description: "Please enter the 6-digit code from your authenticator app.", variant: "destructive" });
             return;
        }

        setIsVerifying2FA(true);
        try {
             const response = await axios.post(
                `${BACKEND_API_BASE_URL}/users/2fa/verify`,
                { token: twoFAVerificationCode }, // Send the 6-digit token
                { headers: { 'Authorization': `Bearer ${token}` }}
             );

             toast({ title: "Success", description: response.data?.message || "Two-factor authentication enabled.", variant: "default" });
             
             // Update context to reflect 2FA enabled status
             updateUserContext({ [TWO_FACTOR_ENABLED_COLUMN]: true });

             // Clear state and hide setup form
             setShow2FASetup(false);
             setTwoFASecret(null);
             setTwoFAOtpUri(null);
             setTwoFAVerificationCode('');

        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to verify 2FA code.";
            toast({ title: "Verification Failed", description: message, variant: "destructive" });
        } finally {
            setIsVerifying2FA(false);
        }
    };

    // --- Handle Copy Secret ---
    const handleCopySecret = () => {
        if (twoFASecret) {
            navigator.clipboard.writeText(twoFASecret).then(() => {
                setSecretCopied(true);
                setTimeout(() => setSecretCopied(false), 2000); // Reset icon after 2s
            }).catch(err => {
                 toast({ title: "Copy Failed", description: "Could not copy secret to clipboard.", variant: "destructive" });
            });
        }
    };

    // --- Handle Disable 2FA Click ---
    const handleDisable2FAClick = async () => {
        if (!token) return;

        // Optional: Add a confirmation dialog
        if (!window.confirm("Are you sure you want to disable Two-Factor Authentication?")) {
            return;
        }

        setIsDisabling2FA(true);
        try {
            const response = await axios.post(
                `${BACKEND_API_BASE_URL}/users/2fa/disable`,
                {}, // No body needed for disable request
                { headers: { 'Authorization': `Bearer ${token}` }}
            );

            toast({ title: "Success", description: response.data?.message || "Two-factor authentication disabled.", variant: "default" });
            
            // Update context to reflect 2FA disabled status
            updateUserContext({ [TWO_FACTOR_ENABLED_COLUMN]: false });

            // Optionally hide the setup form if it was somehow visible
            setShow2FASetup(false); 

        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to disable 2FA.";
            toast({ title: "Error", description: message, variant: "destructive" });
            console.error("Disable 2FA error:", error.response?.data || error);
        } finally {
            setIsDisabling2FA(false);
        }
    };

    // --- UPDATE Account Deletion Handler ---
    const handleDeleteAccountClick = async () => {
        if (!token) return; // Need token to authenticate delete request

        // Confirmation Dialog (Using basic window.confirm for now)
        // TODO: Replace with a nicer Shadcn/UI AlertDialog for better UX
        const confirmDelete = window.confirm(
            "🚨 Are you absolutely sure you want to delete your account? 🚨\n\n" +
            "This action is irreversible and will permanently delete:\n" +
            "  - Your profile information\n" +
            "  - Notification settings\n" +
            "  - Alert preferences and templates\n" +
            "  - Link to your Telegram/Discord (if connected)\n\n" +
            "Your subscription (if active) MAY NOT be automatically canceled. Please manage subscriptions directly via PayPal.\n\n" +
            "Click 'OK' to proceed with permanent deletion."
        );

        if (!confirmDelete) {
            return; // User cancelled
        }

        setIsDeletingAccount(true);

        try {
            const response = await axios.delete(
                `${BACKEND_API_BASE_URL}/users/account`, // Correct DELETE endpoint
                { 
                    headers: { 'Authorization': `Bearer ${token}` } 
                }
            );

            toast({ 
                title: "Account Deleted", 
                description: response.data?.message || "Your account has been permanently deleted.",
                variant: "default" // Use default variant for success
            });

            // Logout the user and redirect (likely to login page)
            logout(); 

        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to delete account. Please try again or contact support.";
            toast({ 
                title: "Deletion Failed", 
                description: message, 
                variant: "destructive" 
            });
            console.error("Account deletion error:", error.response?.data || error);
            setIsDeletingAccount(false); // Re-enable button on failure
        } 
        // No finally block needed for setIsDeletingAccount(false) because logout() navigates away on success
    };
    // -------------------------------------

    // --- Render --- 
    if (!user) {
        // Shouldn't happen if route is protected, but good fallback
        return <div className="p-4">Please log in to view settings.</div>;
    }

    // --- DEBUG LOG - Use state variable ---
    console.log("[Render] Rendering Settings component. avatarSignedUrl:", avatarSignedUrl); 

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-5xl">
            <h1 className="text-3xl font-bold mb-2 text-white font-orbitron">Settings</h1>
            <p className="text-neutral-400 mb-6">Manage your account settings and account settings.</p>

            {/* Update Tabs: Control value and handle change */}
            <Tabs 
                value={activeTab} // Controlled by state
                onValueChange={(value) => {
                    setActiveTab(value); // Update state
                    window.location.hash = value; // Update URL hash
                }}
                className="w-full"
            >
                <TabsList className="grid w-full grid-cols-1 mb-6 bg-neutral-800/50 border border-neutral-700/50 p-1 h-auto">
                    <TabsTrigger value="account" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Account</TabsTrigger>
                </TabsList>

                {/* --- Account Tab Content --- */}
                <TabsContent value="account" className="space-y-8 mt-0">
                    {/* Profile Information Section */}
                    <Card className="bg-neutral-800/50 border-neutral-700/50">
                        <CardHeader>
                            <CardTitle className="text-white font-orbitron">Profile</CardTitle>
                            <CardDescription className="text-neutral-400">Update your personal information</CardDescription>
                        </CardHeader>
                        <form onSubmit={handleProfileUpdate}>
                            <CardContent className="space-y-4">
                                {/* Photo Upload Placeholder */}
                                <div className="space-y-2">
                                    <Label className="text-neutral-300">Profile Photo</Label>
                                    <div className="flex items-center gap-4">
                                        {/* Hidden File Input */}
                                        <input 
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelected}
                                            accept="image/png, image/jpeg, image/gif" // Specify accepted types
                                            style={{ display: 'none' }} 
                                        />
                                        {/* Display Image - Use state variable */}
                                        <img 
                                            key={avatarSignedUrl + avatarCacheBuster} // MODIFIED: Use signed URL + cache buster for key
                                            src={isFetchingAvatarUrl ? generateFallbackAvatar(undefined, undefined) : (avatarSignedUrl ? `${avatarSignedUrl}${avatarCacheBuster}` : generateFallbackAvatar(profileName, user?.[EMAIL_COLUMN]))} // MODIFIED: Append cache buster
                                            alt="Profile Avatar" 
                                            className="w-16 h-16 rounded-full bg-neutral-600 object-cover border-2 border-neutral-600"
                                            onError={(e) => { 
                                                const target = e.target as HTMLImageElement;
                                                const fallbackSrc = generateFallbackAvatar(profileName, user?.[EMAIL_COLUMN]);
                                                if (target.src !== fallbackSrc) {
                                                    target.onerror = null; // prevent infinite loop only if not already fallback
                                                    target.src = fallbackSrc; // Use helper
                                                }
                                            }}
                                        />
                                        {/* Change Photo Button */}
                                        <Button 
                                            variant="outline" 
                                            type="button" 
                                            onClick={handleChangePhotoClick} 
                                            disabled={isPhotoUploading || isFetchingAvatarUrl} // Disable while fetching/uploading
                                            className="border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80"
                                        >
                                            {isPhotoUploading || isFetchingAvatarUrl ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Change Photo
                                        </Button>
                                    </div>
                                    <p className="text-xs text-neutral-500">JPG, GIF or PNG. 1MB max.</p>
                                </div>
                                 {/* Full Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="profileName" className="text-neutral-300">Full Name</Label>
                                    <Input 
                                        id="profileName" 
                                        value={profileName} 
                                        onChange={(e) => setProfileName(e.target.value)}
                                        className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    />
                                </div>
                                 {/* Company Name (Optional) */}
                                <div className="space-y-2">
                                    <Label htmlFor="companyName" className="text-neutral-300">Company Name <span className="text-neutral-500">(Optional)</span></Label>
                                    <Input 
                                        id="companyName" 
                                        value={companyName} 
                                        onChange={(e) => setCompanyName(e.target.value)} 
                                        placeholder="Your Company"
                                        className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90" disabled={isProfileLoading}>
                                     {isProfileLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Save Profile
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
            
                    {/* Security Section */} 
                    <Card className="mb-6 bg-neutral-800/50 border-neutral-700/50">
                        <CardHeader>
                            <CardTitle className="text-white font-orbitron">Security</CardTitle>
                            <CardDescription className="text-neutral-400">Manage your account security settings.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                           {/* --- Change Password Section --- */} 
                           <div className="p-4 border border-neutral-700 rounded-md space-y-4">
                               <div className="flex justify-between items-center">
                                   <div>
                                       <p className="text-neutral-200 font-medium">Change Password</p>
                                       <p className="text-xs text-neutral-400">Update your account password.</p>
                                   </div>
                                   {!showPasswordForm && (
                                       <Button 
                                           variant="outline" 
                                           onClick={handleChangePasswordClick} 
                                           className="border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80"
                                       >
                                           Change
                                       </Button>
                                   )}
                               </div>

                               {/* --- Conditionally Rendered Password Form --- */}
                               {showPasswordForm && (
                                    <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
                                         <div className="space-y-2">
                                             <Label htmlFor="currentPassword" className="text-neutral-300">Current Password</Label>
                                             <Input 
                                                 id="currentPassword"
                                                 type="password"
                                                 value={currentPassword}
                                                 onChange={(e) => setCurrentPassword(e.target.value)}
                                                 required
                                                 className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                             />
                                         </div>
                                         <div className="space-y-2">
                                             <Label htmlFor="newPassword" className="text-neutral-300">New Password</Label>
                                             <Input 
                                                 id="newPassword"
                                                 type="password"
                                                 value={newPassword}
                                                 onChange={(e) => setNewPassword(e.target.value)}
                                                 required
                                                 className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                             />
                                             <p className="text-xs text-neutral-500">Must be at least 8 characters.</p>
                                         </div>
                                          <div className="space-y-2">
                                             <Label htmlFor="confirmPassword" className="text-neutral-300">Confirm New Password</Label>
                                             <Input 
                                                 id="confirmPassword"
                                                 type="password"
                                                 value={confirmPassword}
                                                 onChange={(e) => setConfirmPassword(e.target.value)}
                                                 required
                                                 className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow"
                                             />
                                         </div>
                                         <div className="flex justify-end gap-3 pt-2">
                                            <Button 
                                                 variant="ghost" 
                                                 type="button" 
                                                 onClick={() => {
                                                     setShowPasswordForm(false);
                                                     setCurrentPassword('');
                                                     setNewPassword('');
                                                     setConfirmPassword('');
                                                 }}
                                                 className="text-neutral-400 hover:text-white hover:bg-neutral-700"
                                             >
                                                 Cancel
                                             </Button>
                                             <Button 
                                                 type="submit" 
                                                 className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                                                 disabled={isPasswordChanging}
                                             >
                                                 {isPasswordChanging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                 Save New Password
                                             </Button>
                                         </div>
                                    </form>
                               )}
                           </div>
                           {/* --- End Change Password Section --- */}

                           {/* --- Two-Factor Auth Section --- */} 
                           <div className="p-4 border border-neutral-700 rounded-md space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex-1">
                                        <p className="text-neutral-200 font-medium">Two-Factor Authentication</p>
                                        <p className="text-xs text-neutral-400">Add an extra layer of security to your account.</p>
                                    </div>
                                    {/* Show Enable/Disable button OR Status based on context */} 
                                    {isTwoFactorEnabled ? (
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <Badge variant="default" className="bg-green-600/80 text-green-100 border-green-500/50 text-xs px-2 py-0.5">
                                                <Check className="mr-1 h-3 w-3"/> Enabled
                                            </Badge>
                                            <Button 
                                                variant="destructive"
                                                onClick={handleDisable2FAClick}
                                                disabled={isDisabling2FA}
                                                className="bg-red-700/80 hover:bg-red-600/90 text-white text-xs h-8"
                                            >
                                                {isDisabling2FA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Disable 2FA
                                            </Button>
                                        </div>
                                    ) : (
                                         <Button 
                                             variant="outline" 
                                             onClick={handleEnable2FAClick} 
                                             disabled={isEnabling2FA || show2FASetup} // Disable if already enabling/showing
                                             className="border-neutral-600 bg-neutral-700/60 text-neutral-300 hover:bg-neutral-600/80 text-xs h-8 flex-shrink-0"
                                         >
                                             {isEnabling2FA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                             Enable 2FA
                                         </Button>
                                    )}
                                </div>

                                {/* --- Conditionally Rendered 2FA Setup --- */} 
                                {show2FASetup && !isTwoFactorEnabled && (
                                    <div className="pt-4 space-y-6 border-t border-neutral-700/50">
                                        {(isEnabling2FA || !twoFAOtpUri) ? (
                                            <div className="flex items-center justify-center text-neutral-400">
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating setup information...
                                            </div>
                                        ) : (
                                            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                                                {/* QR Code */} 
                                                <div className="p-3 bg-white rounded-lg">
                                                    <QRCodeCanvas value={twoFAOtpUri!} size={160} level="M" />
                                                </div>
                                                {/* Instructions & Manual Entry */} 
                                                <div className="flex-1 space-y-3">
                                                    <p className="text-sm text-neutral-300">
                                                        Scan the QR code with your authenticator app (like Google Authenticator, Authy, etc.).
                                                    </p>
                                                    <p className="text-sm text-neutral-300">
                                                        If you can't scan, manually enter this secret key:
                                                    </p>
                                                    <div className="flex items-center gap-2 p-2 rounded-md bg-neutral-800">
                                                        <code className="text-trendy-yellow font-mono break-all flex-1">
                                                            {twoFASecret}
                                                        </code>
                                                        <Button 
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={handleCopySecret}
                                                            className="text-neutral-400 hover:text-white h-7 w-7"
                                                            type="button"
                                                        >
                                                            {secretCopied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                                 {/* Verification Form */} 
                                                 {!isEnabling2FA && twoFAOtpUri && (
                                                    <form onSubmit={handle2FAVerificationSubmit} className="space-y-4 pt-4 border-t border-neutral-700/50">
                                                         <div className="space-y-2">
                                                             <Label htmlFor="twoFAVerificationCode" className="text-neutral-300">Enter Verification Code</Label>
                                                             <Input 
                                                                 id="twoFAVerificationCode"
                                                                 type="text"
                                                                 inputMode="numeric"
                                                                 pattern="\d{6}"
                                                                 maxLength={6}
                                                                 value={twoFAVerificationCode}
                                                                 onChange={(e) => setTwoFAVerificationCode(e.target.value.replace(/\D/g, ''))} // Allow only digits
                                                                 placeholder="6-digit code"
                                                                 required
                                                                 className="bg-neutral-700/60 border-neutral-600 text-white placeholder:text-neutral-500 focus-visible:ring-trendy-yellow w-40"
                                                             />
                                                             <p className="text-xs text-neutral-500">Enter the code from your authenticator app.</p>
                                                         </div>
                                                         <div className="flex justify-end gap-3 pt-2">
                                                            <Button 
                                                                 variant="ghost" 
                                                                 type="button" 
                                                                 onClick={() => setShow2FASetup(false)} // Simple cancel
                                                                 className="text-neutral-400 hover:text-white hover:bg-neutral-700"
                                                             >
                                                                 Cancel Setup
                                                             </Button>
                                                             <Button 
                                                                 type="submit" 
                                                                 className="bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90"
                                                                 disabled={isVerifying2FA || twoFAVerificationCode.length !== 6}
                                                             >
                                                                 {isVerifying2FA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                                 Verify & Enable
                                                             </Button>
                                                         </div>
                                                    </form>
                                                 )}
                                            </div>
                                        )}
                           </div>
                           {/* --- End Two-Factor Auth Section --- */} 

                         </CardContent>
                    </Card>

                    {/* Delete Account Section */} 
                    <Card className="border-red-700/50 bg-red-900/20">
                        <CardHeader>
                            <CardTitle className="text-red-300 font-orbitron">Delete Account</CardTitle>
                            <CardDescription className="text-red-400/80">Permanently delete your account and all associated data. This action cannot be undone.</CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button 
                                variant="destructive" 
                                onClick={handleDeleteAccountClick} // Connect the updated handler
                                disabled={isDeletingAccount} // Use loading state
                                className="bg-red-700/80 hover:bg-red-600/90 text-white"
                            >
                                 {isDeletingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {/* Use loader */}
                                Delete My Account
                            </Button>
                        </CardFooter>
                    </Card>
                 </TabsContent>
            </Tabs>
        </div>
    );
};

export default Settings;
