// Placeholder Component - Requires shadcn Card and Avatar
import React from 'react';
import { cn } from '../../lib/utils';
// Assumes these exist from shadcn/ui setup
import { Card, CardContent } from "./card"; 
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

export interface TestimonialAuthor {
  name: string;
  handle: string;
  avatar: string;
}

interface TestimonialCardProps {
  author: TestimonialAuthor;
  text: string;
  href?: string;
  className?: string;
}

export function TestimonialCard({ author, text, href, className }: TestimonialCardProps) {
  const cardContent = (
    <Card className={cn(
      "h-full w-[350px] shrink-0 rounded-xl border border-neutral-700 bg-neutral-800/50 p-6 flex flex-col",
      className
    )}>
      <CardContent className="flex-grow text-neutral-300 text-base leading-relaxed">
        "{text}"
      </CardContent>
      <div className="mt-6 flex items-center gap-4 pt-4 border-t border-neutral-700/40">
        <Avatar>
          <AvatarImage src={author.avatar} alt={author.name} />
          <AvatarFallback>{author.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-white text-base">{author.name}</p>
          <p className="text-sm text-neutral-400">{author.handle}</p>
        </div>
      </div>
    </Card>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {cardContent}
      </a>
    );
  }

  return cardContent;
} 