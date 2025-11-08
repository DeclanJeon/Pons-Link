/**
 * 링크 미리보기 카드 컴포넌트
 * @module LinkPreviewCard
 */

import { LinkPreview } from '@/types/chat.types';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewCardProps {
  preview: LinkPreview;
}

export const LinkPreviewCard = ({ preview }: LinkPreviewCardProps) => {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 bg-secondary/30 rounded-lg hover:bg-secondary/50 transition-colors border border-border/30"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title}
          className="w-full h-32 object-cover rounded-md mb-2"
          loading="lazy"
        />
      )}
      <div className="space-y-1">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          {preview.title}
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </h4>
        {preview.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {preview.description}
          </p>
        )}
        {preview.siteName && (
          <p className="text-[10px] text-muted-foreground/70">
            {preview.siteName}
          </p>
        )}
      </div>
    </a>
  );
};