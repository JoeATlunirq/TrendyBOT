import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import PayPalSubscriptionButton from '@/components/PayPalSubscriptionButton';
import { cn } from '@/lib/utils';
import { CreditCard, Star, Check } from 'lucide-react';

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

// Get column names from environment variables (Vite)
const NAME_COLUMN = import.meta.env.VITE_NAME_COLUMN || 'name';
const COMPANY_COLUMN = import.meta.env.VITE_COMPANY_COLUMN || 'company_name';
const PROFILE_PHOTO_URL_COLUMN = import.meta.env.VITE_PROFILE_PHOTO_URL_COLUMN || 'profile_photo_url';
const CURRENT_PLAN_COLUMN = 'current_plan'; // Field name from NocoDB

// Notification Column Names (Ensure these match backend .env and NocoDB)
const TELEGRAM_ID_COLUMN = 'telegram_chat_id';
const DISCORD_URL_COLUMN = 'discord_webhook_url';
const DELIVERY_PREF_COLUMN = 'delivery_preference';

// Define Plan structure
interface Plan {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    isPopular?: boolean;
    paypalPlanId: string; // Use LIVE PayPal Plan ID
}

const Settings = () => {
    const { user, token, logout, currentPlan } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    // --- Profile State ---
    const [profileName, setProfileName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [isProfileLoading, setIsProfileLoading] = useState(false);
    
    // Get user's current plan from NocoDB data
    const userCurrentPlan = user && user[CURRENT_PLAN_COLUMN] ? user[CURRENT_PLAN_COLUMN] : '';
    
    // Initialize state with user data from context
    useEffect(() => {
        if (user) {
            setProfileName(user[NAME_COLUMN] || ''); 
            setCompanyName(user[COMPANY_COLUMN] || '');
        }
    }, [user]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) return; // Should be logged in
        setIsProfileLoading(true);

        try {
            const response = await axios.put(
                `${BACKEND_API_BASE_URL}/users/profile`,
                { 
                    name: profileName, // Send 'name' 
                    companyName: companyName // Send 'companyName'
                },
                { headers: { 'Authorization': `Bearer ${token}` }}
            );

            toast({ title: "Profile Updated", description: response.data?.message || "Your profile has been saved." });
            // Optionally update user state in AuthContext if backend sends back full user
            // Note: AuthContext doesn't expose setUser, might need refresh or manual update
            if (response.data?.user) {
                 localStorage.setItem('trendy_user', JSON.stringify(response.data.user)); // Update local storage
            }

        } catch (error: any) {
            const message = error.response?.data?.message || "Failed to update profile.";
            toast({ title: "Update Failed", description: message, variant: "destructive" });
            console.error("Profile update error:", error.response?.data || error);
        } finally {
            setIsProfileLoading(false);
        }
    };

    // Define plans WITH CORRECT PayPal Plan IDs and Features
    const plans: Plan[] = [
        {
            name: "Spark",
            price: "7",
            period: "/PM",
            description: "For creators just getting started with trend tracking.",
            features: [
                "5 Alerts/Month",
                "1 Niche Monitor",
                "Email Alerts Only",
                "Standard Detection Speed",
                "Weekly Digest"
            ],
            paypalPlanId: 'P-4Y4434518B3747137NACRKNY' // LIVE Spark Plan ID
        },
        {
            name: "Surge",
            price: "10",
            period: "/PM",
            description: "For creators and marketers growing fast and reacting faster.",
            features: [
                "25 Alerts/Month",
                "Up to 3 Niche/Channel Trackers",
                "Telegram + Discord Alerts",
                "Engagement Scoring",
                "Faster Detection Window"
            ],
            isPopular: true,
            paypalPlanId: 'P-6NC15818DS298615RNACRLEY' // LIVE Surge Plan ID
        },
        {
            name: "Viral",
            price: "12",
            period: "/PM",
            description: "For trend-obsessed power users, agencies, and ops teams.",
            features: [
                "Unlimited Alerts",
                "Unlimited Niche + Channel Tracking",
                "Priority Alert Speed",
                "Custom Thresholds",
                "AI-Powered Recommendations",
                "Export",
                "VIP Support",
                "Current Short niches ranking"
            ],
            paypalPlanId: 'P-4XX40417EU7326443NACRM4Q' // LIVE Viral Plan ID
        }
    ];
    // --------------------------

    // --- Render --- 
    if (!user) {
        // Shouldn't happen if route is protected, but good fallback
        return <div className="p-4">Please log in to view settings.</div>;
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-5xl">
            <h1 className="text-3xl font-bold mb-2 text-white font-orbitron">Settings</h1>
            <p className="text-neutral-400 mb-6">Manage your account settings and notification preferences</p>

            <Tabs defaultValue="account" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6 bg-neutral-800/50 border border-neutral-700/50 p-1 h-auto">
                    <TabsTrigger value="notifications" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Notifications</TabsTrigger>
                    <TabsTrigger value="account" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Account</TabsTrigger>
                    <TabsTrigger value="billing" className="data-[state=active]:bg-neutral-700 data-[state=active]:text-white text-neutral-400">Billing</TabsTrigger>
                </TabsList>

                {/* --- Notifications Tab Content (Simplified) --- */} 
                <TabsContent value="notifications">
                    <Card className="bg-neutral-800/50 border-neutral-700/50">
                <CardHeader>
                            <CardTitle className="text-white font-orbitron">Manage Notifications</CardTitle>
                            <CardDescription className="text-neutral-400">Configure your notification channels, delivery, and templates.</CardDescription>
                </CardHeader>
                        <CardContent>
                            <p className="text-neutral-400">Notification settings have moved.</p>
                <Button 
                                variant="outline" 
                                onClick={() => navigate('/notification-settings')}
                                className="mt-4 border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white"
                            >
                                Go to Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

                {/* --- Account Tab Content --- */} 
                <TabsContent value="account">
                    {/* Profile Section */} 
                    <Card className="mb-6 bg-neutral-800/50 border-neutral-700/50">
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
                                         <img 
                                            src={user[PROFILE_PHOTO_URL_COLUMN] || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName || user.email)}&background=404040&color=e5e5e5&bold=true`}
                                            alt="Profile Avatar" 
                                            className="w-16 h-16 rounded-full bg-neutral-600 object-cover"
                                         />
                                         <Button variant="outline" type="button" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Change Photo (Soon)</Button>
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
                                 {/* Email (Display Only) */} 
                      <div className="space-y-2">
                                    <Label htmlFor="profileEmail" className="text-neutral-300">Email Address</Label>
                                    <Input id="profileEmail" value={user.email} disabled className="bg-neutral-900 border-neutral-700 text-neutral-400" />
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
            
                    {/* Security Section (Placeholder) */} 
                    <Card className="mb-6 bg-neutral-800/50 border-neutral-700/50">
                <CardHeader>
                            <CardTitle className="text-white font-orbitron">Security</CardTitle>
                            <CardDescription className="text-neutral-400">Manage your account security settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                           <div className="flex justify-between items-center p-4 border border-neutral-700 rounded-md">
                               <div>
                                   <p className="text-neutral-200 font-medium">Change Password</p>
                                   <p className="text-xs text-neutral-400">Update your account password.</p>
                    </div>
                               <Button variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Change (Soon)</Button>
                  </div>
                           <div className="flex justify-between items-center p-4 border border-neutral-700 rounded-md">
                               <div>
                                   <p className="text-neutral-200 font-medium">Two-Factor Authentication</p>
                                   <p className="text-xs text-neutral-400">Add an extra layer of security to your account.</p>
                      </div>
                               <Button variant="outline" disabled className="border-neutral-600 bg-neutral-700/60 text-neutral-300">Enable 2FA (Soon)</Button>
                  </div>
                </CardContent>
              </Card>

                    {/* Delete Account Section (Placeholder) */} 
                    <Card className="border-red-700/50 bg-red-900/20">
                <CardHeader>
                            <CardTitle className="text-red-300 font-orbitron">Delete Account</CardTitle>
                            <CardDescription className="text-red-400/80">Permanently delete your account and all associated data. This action cannot be undone.</CardDescription>
                  </CardHeader>
                  <CardFooter>
                            <Button variant="destructive" disabled className="bg-red-700/80 hover:bg-red-600/80 text-white">Delete My Account (Soon)</Button>
                  </CardFooter>
                </Card>
                </TabsContent>

                {/* --- Billing Tab Content (Integrated) --- */} 
                <TabsContent value="billing" className="mt-6">
                     {/* Current Plan Summary - Use context value */}
                     <Card className="mb-8 bg-neutral-800/50 border-neutral-700/50">
                         <CardHeader>
                             <CardTitle className="text-white font-orbitron">Current Subscription</CardTitle>
                         </CardHeader>
                         <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                             <div>
                                 <p className="text-lg font-semibold text-neutral-100">
                                    {userCurrentPlan ? (
                                        <>You are currently on the <span className="text-trendy-yellow">{userCurrentPlan}</span> plan.</>
                                    ) : (
                                        <>You are on the <span className="text-neutral-400">Free</span> plan.</>
                                    )}
                                 </p>
                                 {userCurrentPlan && (
                                     <p className="text-sm text-neutral-400 mt-1">
                                        Manage or cancel your subscription via PayPal.
                                     </p>
                                 )}
                             </div>
                             {userCurrentPlan && (
                                 <div className="flex gap-3">
                                     <Button 
                                         variant="outline" 
                                         onClick={() => window.open('https://www.paypal.com/myaccount/autopay/', '_blank')}
                                         className="border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300 hover:text-white"
                                     >
                                         <CreditCard className="mr-2 h-4 w-4" /> Manage Subscription
                                     </Button>
                                     <Button 
                                         variant="destructive" 
                                         onClick={() => window.open('https://www.paypal.com/myaccount/autopay/', '_blank')}
                                         className="bg-red-700/80 hover:bg-red-600/90"
                                     >
                                         Cancel Subscription
                                     </Button>
                                 </div>
                             )}
                         </CardContent>
                     </Card>

                     {/* Pricing Tiers - Show upgrade/downgrade options based on current plan */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         {plans.map((plan) => {
                             const isCurrentPlan = userCurrentPlan === plan.name;
                             return (
                                 <Card 
                                     key={plan.name}
                                     className={cn(
                                         "flex flex-col bg-neutral-800/50 border-neutral-700/50 backdrop-blur-sm shadow-lg text-neutral-200",
                                         plan.isPopular ? "border-trendy-yellow ring-2 ring-trendy-yellow/50" : "border-neutral-700/50",
                                         isCurrentPlan ? "ring-2 ring-green-500/50" : ""
                                     )}
                                 >
                                     <CardHeader className="pb-4">
                                          {plan.isPopular && !isCurrentPlan && (
                                              <div className="flex justify-end mb-2">
                                                  <Badge variant="default" className="bg-trendy-yellow text-trendy-brown border-none">Most Popular</Badge>
                                              </div>
                                          )}
                                          {isCurrentPlan && (
                                              <div className="flex justify-end mb-2">
                                                  <Badge variant="default" className="bg-green-600 text-white border-none">Current Plan</Badge>
                                              </div>
                                          )}
                                         <CardTitle className="font-orbitron text-white text-xl tracking-wider">{plan.name.toUpperCase()}</CardTitle>
                                         <div className="flex items-baseline gap-1">
                                             <span className="text-4xl font-bold text-white">${plan.price}</span>
                                             <span className="text-sm text-neutral-400 font-medium">{plan.period}</span>
                                         </div>
                                         <CardDescription className="text-neutral-400 pt-1 !mt-1 text-sm">{plan.description}</CardDescription>
                                     </CardHeader>
                                     <CardContent className="flex-1 space-y-3 pt-0 pb-6">
                                          <ul className="space-y-2 text-sm">
                                             {plan.features.map((feature, index) => (
                                                 <li key={index} className="flex items-start gap-2">
                                                     <Check className="h-4 w-4 mt-0.5 text-green-400 flex-shrink-0" />
                                                     <span className="text-neutral-300">{feature}</span>
                                                 </li>
                                             ))}
                                         </ul>
                                     </CardContent>
                                     <CardFooter className="flex-col items-stretch space-y-2">
                                         {isCurrentPlan ? (
                                            <>
                                                <Button 
                                                    variant="outline"
                                                    className="w-full font-semibold border-neutral-600 bg-neutral-700/60 hover:bg-neutral-600/80 text-neutral-300" 
                                                    onClick={() => window.open('https://www.paypal.com/myaccount/autopay/', '_blank')}
                                                >
                                                    <CreditCard className="mr-2 h-4 w-4" /> Manage Subscription
                                                </Button>
                                                <Button 
                                                    variant="destructive"
                                                    className="w-full font-semibold bg-red-700/80 hover:bg-red-600/90 text-white" 
                                                    onClick={() => window.open('https://www.paypal.com/myaccount/autopay/', '_blank')}
                                                >
                                                    Cancel Subscription
                                                </Button>
                                            </>
                                         ) : (
                                             <PayPalSubscriptionButton 
                                                 planId={plan.paypalPlanId} 
                                                 planName={plan.name} 
                                             />
                                         )}
                                     </CardFooter>
                                 </Card>
                             );
                         })}
                     </div>
                 </TabsContent>
            </Tabs>
        </div>
    );
};

export default Settings;
