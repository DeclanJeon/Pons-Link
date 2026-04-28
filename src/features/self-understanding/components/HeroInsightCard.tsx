import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface HeroInsightCardProps {
  label: string;
  summary: string;
  interpretation?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export function HeroInsightCard({ label, summary, interpretation, primaryAction, secondaryAction }: HeroInsightCardProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-card/80 shadow-lg">
      <CardHeader className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary/80">{label}</p>
        <CardTitle className="text-2xl leading-tight md:text-3xl">{summary}</CardTitle>
        {interpretation ? <CardDescription className="max-w-2xl text-sm leading-6 md:text-base">{interpretation}</CardDescription> : null}
      </CardHeader>
      {(primaryAction || secondaryAction) ? (
        <CardFooter className="flex flex-wrap gap-2">
          {primaryAction ?? <Button size="sm">Read more</Button>}
          {secondaryAction}
        </CardFooter>
      ) : null}
      <CardContent />
    </Card>
  );
}
