import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSelfUnderstandingStore } from '../stores/useSelfUnderstandingStore';
import type { InsightCategory } from '../types/selfUnderstanding';

interface SaveInsightButtonProps {
  id: string;
  summary: string;
  category: InsightCategory;
}

export function SaveInsightButton({ id, summary, category }: SaveInsightButtonProps) {
  const saveInsight = useSelfUnderstandingStore((state) => state.saveInsight);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        saveInsight({ id, summary, category });
        toast.success('Saved to your archive.');
      }}
    >
      Save this sentence
    </Button>
  );
}
