import React from 'react';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Safely parses inline markdown (bold, italic, inline code, links)
 * into React nodes WITHOUT dangerouslySetInnerHTML.
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex matches:
  // 1. **bold**
  // 2. *italic* or _italic_
  // 3. `inline code`
  // 4. [text](url)
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-slate-100">
          {parseInline(part.slice(2, -2))}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-800 dark:text-slate-200">
          {parseInline(part.slice(1, -1))}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[13px] font-mono text-teal-800 dark:text-teal-300 border border-slate-200/60 dark:border-slate-700/60"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        const linkText = match[1];
        const href = match[2];
        // Only allow safe protocols
        const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/');
        return (
          <a
            key={idx}
            href={isSafe ? href : '#'}
            target={href.startsWith('/') ? undefined : '_blank'}
            rel="noopener noreferrer"
            className="text-teal-700 dark:text-teal-400 hover:underline font-medium"
          >
            {linkText}
          </a>
        );
      }
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Safe markdown block parser.
 * Renders paragraphs, headings, bullet lists, ordered lists, tables, and blockquotes.
 */
export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split by double newlines for block separation
  const blocks = content.split(/\n\n+/);

  return (
    <div className={`space-y-4 text-slate-800 dark:text-slate-200 ${className}`}>
      {blocks.map((block, bIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Table detection
        if (trimmed.startsWith('|')) {
          const lines = trimmed.split('\n').filter((l) => l.trim().startsWith('|'));
          if (lines.length > 0) {
            const headerLine = lines[0];
            const dataLines = lines.slice(1).filter((l) => !l.includes('---'));

            const parseCells = (line: string) =>
              line
                .split('|')
                .map((c) => c.trim())
                .filter((_, i, arr) => i > 0 && i < arr.length - 1);

            const headers = parseCells(headerLine);

            return (
              <div
                key={bIdx}
                className="my-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"
              >
                <table className="w-full text-xs text-left border-collapse">
                  {headers.length > 0 && (
                    <thead className="bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold">
                      <tr>
                        {headers.map((h, hIdx) => (
                          <th key={hIdx} className="px-3.5 py-2.5">
                            {parseInline(h)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
                    {dataLines.map((row, rIdx) => {
                      const cells = parseCells(row);
                      return (
                        <tr
                          key={rIdx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          {cells.map((c, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300"
                            >
                              {parseInline(c)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          }
        }

        // Headings (#, ##, ###)
        if (trimmed.startsWith('#')) {
          const match = trimmed.match(/^(#{1,4})\s+(.+)$/);
          if (match) {
            const level = match[1].length;
            const headingText = match[2];
            if (level === 1) {
              return (
                <h2
                  key={bIdx}
                  className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 pt-4 pb-1 border-b border-slate-200 dark:border-slate-800"
                >
                  {parseInline(headingText)}
                </h2>
              );
            }
            if (level === 2) {
              return (
                <h3
                  key={bIdx}
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 pt-3"
                >
                  {parseInline(headingText)}
                </h3>
              );
            }
            return (
              <h4
                key={bIdx}
                className="text-base font-semibold text-slate-900 dark:text-slate-100 pt-2"
              >
                {parseInline(headingText)}
              </h4>
            );
          }
        }

        // Blockquote (> ...)
        if (trimmed.startsWith('>')) {
          const quoteLines = trimmed
            .split('\n')
            .map((l) => l.replace(/^>\s?/, ''))
            .join(' ');
          return (
            <blockquote
              key={bIdx}
              className="my-3 pl-4 border-l-2 border-teal-600 dark:border-teal-500 italic text-slate-600 dark:text-slate-300 text-sm leading-relaxed"
            >
              {parseInline(quoteLines)}
            </blockquote>
          );
        }

        // Bullet list (- or * or •)
        const lines = trimmed.split('\n');
        const isBulletList = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        if (isBulletList) {
          return (
            <ul key={bIdx} className="space-y-1.5 my-3 pl-4 list-none text-sm leading-relaxed">
              {lines.map((line, lIdx) => {
                const itemText = line.replace(/^\s*[-*•]\s+/, '');
                return (
                  <li key={lIdx} className="flex items-start gap-2">
                    <span className="text-teal-600 dark:text-teal-400 mt-1 shrink-0">•</span>
                    <span>{parseInline(itemText)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Numbered list (1. 2. ...)
        const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));
        if (isNumberedList) {
          return (
            <ol key={bIdx} className="space-y-1.5 my-3 pl-5 list-decimal text-sm leading-relaxed">
              {lines.map((line, lIdx) => {
                const itemText = line.replace(/^\s*\d+\.\s+/, '');
                return <li key={lIdx}>{parseInline(itemText)}</li>;
              })}
            </ol>
          );
        }

        // Standard Paragraph with soft line breaks
        return (
          <p key={bIdx} className="leading-[1.7] text-slate-800 dark:text-slate-200 text-base">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {parseInline(line)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
};
