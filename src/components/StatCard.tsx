import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  className,
  valueClassName,
  titleClassName,
  descriptionClassName
}) => {
  return (
    <Card className={cn("bg-neutral-800/70 border-neutral-700/60 shadow-lg hover:shadow-trendy-yellow/20 transition-shadow duration-300", className)}>
      <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4")}>
        <CardTitle className={cn("text-sm font-medium text-neutral-300 group-hover:text-trendy-yellow transition-colors", titleClassName)}>
          {title}
        </CardTitle>
        {icon && <div className="text-trendy-yellow">{icon}</div>}
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <div className={cn("text-2xl font-bold text-white", valueClassName)}>
          {value}
        </div>
        {description && (
          <p className={cn("text-xs text-neutral-400 pt-1", descriptionClassName)}>
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard; 