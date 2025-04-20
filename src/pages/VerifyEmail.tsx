
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

const VerifyEmail = () => {
  const [code, setCode] = useState("");
  const { verifyEmail, isLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyEmail(code);
  };

  // Get pending user email if available
  const getPendingEmail = () => {
    const pendingUserJson = localStorage.getItem('trendy_pending_user');
    if (pendingUserJson) {
      try {
        const pendingUser = JSON.parse(pendingUserJson);
        return pendingUser.email;
      } catch (e) {
        return 'your email';
      }
    }
    return 'your email';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-16 h-16 mb-4" />
          <h1 className="text-3xl font-bold">Verify your email</h1>
          <p className="text-muted-foreground">
            We've sent a verification code to {getPendingEmail()}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enter verification code</CardTitle>
            <CardDescription>
              Check your inbox for a 6-digit code
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  id="code"
                  type="text"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  className="text-center text-lg py-6"
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button 
                type="submit" 
                className="w-full bg-trendy-purple hover:bg-trendy-purple/90" 
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify Email"}
              </Button>
              <Button 
                type="button" 
                variant="link"
                className="text-sm"
                onClick={() => {
                  // In a real app, this would trigger a new code to be sent
                  alert("A new verification code has been sent to your email.");
                }}
              >
                Didn't receive a code? Resend
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmail;
