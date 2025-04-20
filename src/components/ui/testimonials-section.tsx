"use client";

import { cn } from "../../lib/utils";
import { TestimonialCard, TestimonialAuthor } from "./testimonial-card";

interface TestimonialsSectionProps {
  title: string;
  description: string;
  testimonials: Array<{
    author: TestimonialAuthor;
    text: string;
    href?: string;
  }>;
  className?: string;
}

export function TestimonialsSection({ 
  title,
  description,
  testimonials,
  className 
}: TestimonialsSectionProps) {
  return (
    <section className={cn(
      "bg-transparent text-neutral-200", // Use transparent bg, inherit from parent
      "py-12 sm:py-24 md:py-32 px-0", // Keep original padding
      className
    )}>
      <div className="mx-auto flex max-w-container flex-col items-center gap-4 text-center sm:gap-16">
        <div className="flex flex-col items-center gap-4 px-4 sm:gap-8">
          {/* Use Orbitron font, adjust colors */}
          <h2 className="max-w-[720px] text-3xl font-orbitron font-semibold leading-tight sm:text-5xl sm:leading-tight text-white">
            {title}
          </h2>
          <p className="text-md max-w-[600px] font-medium text-neutral-400 sm:text-xl">
            {description}
          </p>
        </div>

        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
           {/* Added dark gradient fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-1/4 bg-gradient-to-r from-trendy-brown to-transparent sm:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-1/4 bg-gradient-to-l from-trendy-brown to-transparent sm:block" />
          
          {/* Note: animate-marquee needs definition in CSS/Tailwind */}
          <div className="group flex overflow-hidden p-2 [--gap:1rem] [gap:var(--gap)] flex-row [--duration:40s]">
            <div className="flex shrink-0 justify-around [gap:var(--gap)] animate-marquee flex-row group-hover:[animation-play-state:paused]">
              {[...Array(4)].map((_, setIndex) => (
                testimonials.map((testimonial, i) => (
                  <TestimonialCard 
                    key={`${setIndex}-${i}`}
                    author={testimonial.author}
                    text={testimonial.text}
                    href={testimonial.href}
                  />
                ))
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
} 