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
            className="bg-yellow-300/50 dark:bg-yellow-600/50 text-foreground rounded px-0.5"
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