import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  large?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className, iconOnly = false, large = false }) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex-shrink-0", large ? "h-12 w-12" : "h-8 w-8")}>
        <img src="/Design/500x500-logos/Object Logo.png" alt="Trendy.bot Logo" className="w-full h-full object-contain yellow-glow" />
      </div>
      {!iconOnly && (
        <span className={cn("font-bold text-foreground tracking-wider", large ? "text-3xl" : "text-xl")}>TRENDY</span>
      )}
    </div>
  );
};

// Fallback logo if needed - adjust path if necessary
/*
export const FallbackLogo: React.FC<LogoProps> = ({ className, iconOnly = false }) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
         <span className="font-bold text-primary-foreground text-lg">T</span>
      </div>
       {!iconOnly && (
         <span className="font-semibold text-foreground">Trendy</span>
       )}
    </div>
  );
};
*/
