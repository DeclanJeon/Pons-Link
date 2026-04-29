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
      className="block rounded-xl border border-white/[0.08] bg-black/20 p-3 text-zinc-100 transition-colors hover:bg-white/[0.06]"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt={preview.title}
          className="mb-2 h-32 w-full rounded-lg object-cover"
          loading="lazy"
        />
      )}
      <div className="space-y-1">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          {preview.title}
          <ExternalLink className="w-3 h-3 text-zinc-500" />
        </h4>
        {preview.description && (
          <p className="line-clamp-2 text-xs text-zinc-400">
            {preview.description}
          </p>
        )}
        {preview.siteName && (
          <p className="text-[10px] text-zinc-500">
            {preview.siteName}
          </p>
        )}
      </div>
    </a>
  );
};
