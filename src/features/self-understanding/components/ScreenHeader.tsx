import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ScreenHeaderProps {
  label: string;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function ScreenHeader({ label, title, description, action, className }: ScreenHeaderProps) {
  return (
    <Card className={cn('border-border/60 bg-card/80 backdrop-blur-sm', className)}>
      <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <CardTitle className="text-2xl md:text-3xl">{title}</CardTitle>
          <CardDescription className="max-w-2xl text-sm md:text-base">{description}</CardDescription>
        </div>
        {action ? <CardContent className="p-0 pt-2 md:pt-0">{action}</CardContent> : null}
      </CardHeader>
    </Card>
  );
}
