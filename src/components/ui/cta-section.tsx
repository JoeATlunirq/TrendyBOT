"use client"

// NOTE: Assumes Button and Badge components exist (e.g., via shadcn/ui)
import { Button, buttonVariants } from "./button" // Import buttonVariants if needed
import { Badge } from "./badge"
// Adjusted util path
import { cn } from "../../lib/utils" 

interface CTAProps {
  badge?: {
    text: string
  }
  title: string
  description?: string
  action: {
    text: string
    href: string
    // Manually list common shadcn variants + optional flag for yellow style
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    isYellow?: boolean;
  }
  withGlow?: boolean // Glow might need specific CSS not included here
  className?: string
}

export function CTASection({
  badge,
  title,
  description,
  action,
  withGlow = true, 
  className,
}: CTAProps) {
  return (
    <section className={cn("overflow-hidden pt-0 md:pt-0", className)}> 
      {/* Using dark theme colors */}
      <div className="relative mx-auto flex max-w-container flex-col items-center gap-6 px-8 py-12 text-center sm:gap-8 md:py-24">
        {/* Badge: Adjusted styling */}
        {badge && (
          <Badge
            variant="outline"
            // Adjusted border/text for dark theme
            className="opacity-0 animate-fade-in-up delay-100 border-neutral-700 bg-neutral-800/50"
          >
            <span className="text-neutral-400">{badge.text}</span>
          </Badge>
        )}

        {/* Title: Orbitron font, light text */}
        <h2 className="text-3xl font-orbitron font-semibold sm:text-5xl opacity-0 animate-fade-in-up delay-200 text-white">
          {title}
        </h2>

        {/* Description: Lighter text */}
        {description && (
          <p className="text-neutral-400 opacity-0 animate-fade-in-up delay-300">
            {description}
          </p>
        )}

        {/* Action Button: Apply yellow style conditionally */}
        <Button
          variant={action.variant || 'default'} 
          size="lg"
          className={cn(
            "opacity-0 animate-fade-in-up delay-500",
            // Apply specific yellow styling if isYellow is true
            action.isYellow && "bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 font-orbitron font-bold"
          )}
          asChild // Use anchor tag for navigation
        >
          <a href={action.href}>{action.text}</a>
        </Button>

        {/* Glow Effect: May need specific CSS definitions for shadow-glow */}
        {withGlow && (
          <div className="fade-top-lg pointer-events-none absolute inset-0 rounded-2xl shadow-glow opacity-0 animate-scale-in delay-700" />
        )}
      </div>
    </section>
  )
} 