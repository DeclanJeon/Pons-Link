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
        toast.success('보관함에 저장했어요.');
      }}
    >
      이 문장 저장하기
    </Button>
  );
}
