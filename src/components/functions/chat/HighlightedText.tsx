/**
 * 검색어 하이라이트 컴포넌트
 * @module HighlightedText
 */

interface HighlightedTextProps {
  text: string;
  query: string;
}

export const HighlightedText = ({ text, query }: HighlightedTextProps) => {
  if (!query) return <>{text}</>;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-amber-300/70 px-0.5 text-zinc-950"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};
