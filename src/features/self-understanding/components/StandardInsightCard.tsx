import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StandardInsightCardProps {
  label: string;
  summary: string;
  interpretation?: string;
  example?: string;
  action?: string;
  meaning?: string;
  className?: string;
}

export function StandardInsightCard({ label, summary, interpretation, example, action, meaning, className }: StandardInsightCardProps) {
  const normalizedExample = example?.replace(/^예를 들면[.\s]*/u, '');
  const normalizedMeaning = meaning?.replace(/^의미[.\s]*/u, '');
  const normalizedAction = action?.replace(/^작은 제안[.\s]*/u, '');

  return (
    <Card className={cn('border-border/60 bg-card/70 backdrop-blur-sm', className)}>
      <CardHeader className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <h3 className="text-lg font-semibold leading-snug md:text-xl">{summary}</h3>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground md:text-[15px]">
        {interpretation ? <CardDescription className="text-sm leading-6 text-muted-foreground md:text-[15px]">{interpretation}</CardDescription> : null}
        {normalizedExample ? <p><span className="font-medium text-foreground">예를 들면.</span> {normalizedExample}</p> : null}
        {normalizedMeaning ? <p><span className="font-medium text-foreground">의미.</span> {normalizedMeaning}</p> : null}
        {normalizedAction ? <p className="rounded-md bg-muted/50 px-3 py-2 text-foreground"><span className="font-medium">작은 제안.</span> {normalizedAction}</p> : null}
      </CardContent>
    </Card>
  );
}
