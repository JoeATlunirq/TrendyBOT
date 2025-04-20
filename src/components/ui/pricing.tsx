"use client";

// NOTE: Assumes Button, Label, Switch components exist (e.g., via shadcn/ui)
import { Button, buttonVariants } from "./button"; 
import { Label } from "./label";
import { Switch } from "./switch";
// Adjusted hook path
import { useMediaQuery } from "../../hooks/use-media-query";
// Adjusted util path
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
// Removed next/link import
// import Link from "next/link";
import { useState, useRef } from "react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";

interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular: boolean;
  isYellowButton?: boolean; // Added for custom styling
}

interface PricingProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  className?: string;
}

export function Pricing({
  plans,
  // Updated default title/description for Trendy.bot
  title = "Simple Pricing for Trend Spotters",
  description = "Choose the plan that fits your needs to start catching YouTube Shorts trends faster.",
  className
}: PricingProps) {
  const [isMonthly, setIsMonthly] = useState(true);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const switchRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (checked: boolean) => {
    setIsMonthly(!checked);
    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      // Use Trendy.bot colors for confetti
      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          x: x / window.innerWidth,
          y: y / window.innerHeight,
        },
        colors: [ 
          '#F6D44C', // trendy-yellow
          '#FFFFFF', // white
          '#A3A3A3', // neutral-400
          '#525252', // neutral-600
        ],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ["circle"],
      });
    }
  };

  return (
    <div className={cn("container py-20 text-neutral-300", className)}>
      <div className="text-center space-y-4 mb-12 max-w-3xl mx-auto">
        <h2 className="text-4xl font-orbitron font-bold tracking-tight sm:text-5xl text-white">
          {title}
        </h2>
        <p className="text-neutral-400 text-lg whitespace-pre-line">
          {description}
        </p>
      </div>

      <div className="flex justify-center items-center mb-10">
        {/* <Label>Monthly</Label> Optional label */}
        <Switch
            ref={switchRef as any}
            checked={!isMonthly}
            onCheckedChange={handleToggle}
            // Adjusted styling for dark theme
            className="relative mx-4 data-[state=checked]:bg-trendy-yellow data-[state=unchecked]:bg-neutral-700"
            // Thumb styling adjustment might be needed in Switch component itself or via CSS
            // thumbClassName="bg-white"
        />
        <span className="ml-2 font-semibold text-neutral-200">
          Annual billing <span className="text-trendy-yellow">(Save 20%)</span>
        </span>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-4 justify-items-center mx-auto">
        {plans.map((plan, index) => (
          <motion.div
            key={index}
            initial={{ y: 50, opacity: 1 }} 
            whileInView={ 
              isDesktop 
                ? { 
                    y: plan.isPopular ? -20 : 0,
                    opacity: 1,
                    x: index === 2 ? -30 : index === 0 ? 30 : 0,
                    scale: index === 0 || index === 2 ? 0.94 : 1.0,
                  }
                : {} 
            }
            viewport={{ once: true }}
            transition={{
              duration: 1.6,
              type: "spring",
              stiffness: 100,
              damping: 30,
              delay: 0.4,
              opacity: { duration: 0.5 },
            }}
            className={cn(
              // Adjusted base bg/border for dark theme
              `rounded-2xl border p-6 text-center lg:flex lg:flex-col lg:justify-center relative`,
              plan.isPopular ? "border-trendy-yellow border-2 bg-neutral-800/50" : "border-neutral-700 bg-neutral-800/50",
              "flex flex-col",
              !plan.isPopular && "mt-5",
              index === 0 || index === 2 
                ? "z-0 transform translate-x-0 translate-y-0 -translate-z-[50px] rotate-y-[10deg]" 
                : "z-10",
              index === 0 && "origin-right",
              index === 2 && "origin-left"
            )}
          >
            {plan.isPopular && (
              // Adjusted popular badge colors
              <div className="absolute top-0 right-0 bg-trendy-yellow py-0.5 px-2 rounded-bl-xl rounded-tr-xl flex items-center">
                <Star className="text-trendy-brown h-4 w-4 fill-current" /> 
                <span className="text-trendy-brown ml-1 font-sans font-semibold">
                  Popular
                </span>
              </div>
            )}
            <div className="flex-1 flex flex-col">
              <p className="text-base font-semibold text-neutral-400">
                {plan.name}
              </p>
              <div className="mt-6 flex items-center justify-center gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-white">
                  <NumberFlow
                    value={
                      isMonthly ? Number(plan.price) : Number(plan.yearlyPrice)
                    }
                    format={{
                      style: "currency",
                      currency: "USD",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }}
                    transformTiming={{
                      duration: 500,
                      easing: "ease-out",
                    }}
                    willChange
                    className="font-variant-numeric: tabular-nums"
                  />
                </span>
                {plan.period !== "Next 3 months" && ( 
                  <span className="text-sm font-semibold leading-6 tracking-wide text-neutral-500">
                    / {plan.period}
                  </span>
                )}
              </div>

              <p className="text-xs leading-5 text-neutral-500">
                {isMonthly ? "billed monthly" : "billed annually"}
              </p>

              <ul className="mt-5 gap-2 flex flex-col text-neutral-300 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-trendy-yellow mt-1 flex-shrink-0" /> 
                    <span className="text-left">{feature}</span>
                  </li>
                ))}
              </ul>

              <hr className="w-full my-4 border-neutral-700" /> 

              <Button
                asChild
                variant={plan.isPopular ? 'default' : 'outline'} 
                className={cn(
                  "group relative w-full gap-2 overflow-hidden text-lg font-semibold tracking-tighter",
                  "transform-gpu ring-offset-current transition-all duration-300 ease-out", 
                  plan.isPopular
                    ? "bg-trendy-yellow text-trendy-brown hover:bg-trendy-yellow/90 ring-trendy-yellow"
                    : "bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-700/50 hover:text-white ring-neutral-600",
                  "hover:ring-2 hover:ring-offset-2"
                )}
              >
                 <a href={plan.href}>{plan.buttonText}</a>
              </Button>
              <p className="mt-6 text-xs leading-5 text-neutral-500">
                {plan.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
} 