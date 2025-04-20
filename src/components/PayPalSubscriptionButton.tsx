import React, { useEffect, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';

// Define window interface to include paypal
declare global {
    interface Window { 
        paypal: any; // Use 'any' for simplicity, or install @types/paypal__paypal-js
    } 
}

interface PayPalSubscriptionButtonProps {
    planId: string;
    planName: string; // For logging/toast messages
}

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

const PayPalSubscriptionButton: React.FC<PayPalSubscriptionButtonProps> = ({ planId, planName }) => {
    const paypalRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const { token } = useAuth(); // Get token for potential backend call

    useEffect(() => {
        if (!planId) {
            console.error("PayPal Button: Missing planId prop");
            return;
        }
        if (!paypalRef.current) {
             console.error("PayPal Button: paypalRef is not assigned.");
             return;
        }
        if (!window.paypal) {
             console.error("PayPal SDK script not loaded or window.paypal not available.");
             toast({ title: "Error", description: "PayPal script failed to load. Please refresh.", variant: "destructive" });
             return;
        }

        try {
            // Ensure the container is empty before rendering
            if (paypalRef.current) {
                paypalRef.current.innerHTML = '';
            }
            
            window.paypal.Buttons({
                style: {
                    shape: 'pill',
                    color: 'black',
                    layout: 'vertical',
                    label: 'subscribe'
                },
                createSubscription: function(data: any, actions: any) {
                    console.log('Creating subscription for planId:', planId);
                    // IMPORTANT: For production, you would typically call your backend here
                    // to create the subscription securely using the PayPal REST API & your Secret Key.
                    // Your backend would return the subscription ID created.
                    // Example backend call (conceptual):
                    /*
                    return axios.post('/api/paypal/create-subscription', { planId }, { headers: { Authorization: `Bearer ${token}` } })
                           .then(res => res.data.subscriptionId);
                    */
                    // Using client-side creation based on provided script (less secure/flexible):
                    return actions.subscription.create({ plan_id: planId });
                },
                onApprove: async function(data: any, actions: any) {
                    console.log('PayPal onApprove data:', data);
                    toast({ 
                        title: "PayPal Approval Received", 
                        description: `Subscription ID: ${data.subscriptionID}. Finalizing with server...`,
                        duration: 10000 // Keep toast longer
                    });
                    
                    // --- Call Backend to Verify & Activate --- 
                    if (!token) {
                         toast({ title: "Error", description: "Authentication token missing. Cannot activate plan.", variant: "destructive" });
                         return; // Or handle re-authentication
                    }

                    try {
                        // Call your new backend endpoint
                        const response = await axios.post(
                            `${BACKEND_API_BASE_URL}/paypal/approve-subscription`, 
                            { 
                                subscriptionID: data.subscriptionID,
                                // Optionally pass planName or planId if needed by backend for mapping
                                // planId: planId 
                            },
                            { headers: { 'Authorization': `Bearer ${token}` }}
                        );

                        toast({ title: "Success!", description: response.data.message || `Your ${planName} plan is now active.` });
                        
                        // IMPORTANT: Reload or update context to reflect the new plan
                        // Simplest way is often a reload after a short delay
                        setTimeout(() => window.location.reload(), 2000);
                        
                    } catch (error: any) {
                        console.error("Backend approval failed:", error);
                        const message = error.response?.data?.message || "Failed to activate subscription on our server. Please contact support.";
                        toast({ title: "Activation Error", description: message, variant: "destructive" });
                    }
                   // alert(`Subscription approved with ID: ${data.subscriptionID}. Backend integration needed to activate plan.`); 
                },
                 onError: function(err: any) {
                    console.error("PayPal Buttons onError:", err);
                    toast({ title: "PayPal Error", description: "An error occurred with the PayPal button.", variant: "destructive" });
                 },
                 onCancel: function(data: any) {
                     console.log("Subscription cancelled:", data);
                     toast({ title: "Subscription Cancelled", description: "You cancelled the subscription process.", variant: "default" });
                 }
            }).render(paypalRef.current); // Render the button

        } catch (error) {
             console.error("Failed to render PayPal Buttons:", error);
             toast({ title: "Error", description: "Could not display PayPal button.", variant: "destructive" });
        }

        // Cleanup function (optional, might be needed if component re-renders often)
        // return () => {
        //    if (paypalRef.current) paypalRef.current.innerHTML = "";
        // };

    }, [planId, token, toast, planName]); // Rerun effect if planId changes

    return <div ref={paypalRef}></div>;
};

export default PayPalSubscriptionButton; 