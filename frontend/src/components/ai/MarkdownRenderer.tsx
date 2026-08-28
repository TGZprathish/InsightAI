import React from 'react';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and links.
 */
function parseInline(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  // Tokenize by bold (**...**), inline code (`...`), italic (*...*)
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      elements.push(text.substring(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      elements.push(
        <strong key={match.index} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      elements.push(
        <code
          key={match.index}
          style={{
            fontFamily: 'monospace',
            fontSize: '0.8125em',
            padding: '0.15em 0.4em',
            background: 'var(--bg-surface)',
            color: 'var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      elements.push(
        <em key={match.index} style={{ fontStyle: 'italic', opacity: 0.9 }}>
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    elements.push(text.substring(lastIdx));
  }

  return elements;
}

export default function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Skip completely empty lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Headings (# H1, ## H2, ### H3, #### H4)
    if (trimmed.startsWith('#### ')) {
      blocks.push(
        <h5
          key={i}
          style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '1.1rem',
            marginBottom: '0.4rem',
          }}
        >
          {parseInline(trimmed.substring(5))}
        </h5>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h4
          key={i}
          style={{
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '1.25rem',
            marginBottom: '0.5rem',
            letterSpacing: '-0.01em',
          }}
        >
          {parseInline(trimmed.substring(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h3
          key={i}
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            marginTop: '1.35rem',
            marginBottom: '0.6rem',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '0.35rem',
          }}
        >
          {parseInline(trimmed.substring(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h2
          key={i}
          style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '1.5rem',
            marginBottom: '0.65rem',
          }}
        >
          {parseInline(trimmed.substring(2))}
        </h2>
      );
      i++;
      continue;
    }

    // 3. Blockquotes / Callout Highlights (> ...)
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().substring(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          style={{
            margin: '1rem 0',
            padding: '0.875rem 1.25rem',
            background: 'rgba(99, 102, 241, 0.08)',
            borderLeft: '4px solid var(--color-primary)',
            borderRadius: '0 var(--radius-md) var(--radius-md) 0',
            fontSize: '0.9375rem',
            color: 'var(--text-primary)',
            lineHeight: 1.65,
          }}
        >
          {quoteLines.map((ql, qIdx) => (
            <p key={qIdx} style={{ margin: qIdx > 0 ? '0.45rem 0 0' : 0 }}>
              {parseInline(ql)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // 4. Markdown Tables (| Col1 | Col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        const bodyLines = tableLines.slice(tableLines[1].includes('---') ? 2 : 1);

        blocks.push(
          <div
            key={`table-${i}`}
            style={{
              overflowX: 'auto',
              margin: '1.25rem 0',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border-default)' }}>
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {parseInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyLines.map((row, rIdx) => {
                  const cells = row
                    .split('|')
                    .slice(1, -1)
                    .map((c) => c.trim());
                  return (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: rIdx < bodyLines.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                      }}
                    >
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} style={{ padding: '0.65rem 1rem', color: 'var(--text-primary)' }}>
                          {parseInline(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 5. Unordered Lists (- item or * item)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().substring(2));
        i++;
      }
      blocks.push(
        <ul
          key={`list-${i}`}
          style={{
            margin: '0.65rem 0',
            paddingLeft: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            fontSize: '0.9375rem',
            lineHeight: 1.65,
          }}
        >
          {listItems.map((item, idx) => (
            <li key={idx} style={{ color: 'var(--text-primary)' }}>
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Numbered Lists (1. item, 2. item)
    if (/^\d+\.\s/.test(trimmed)) {
      const numItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s/, '');
        numItems.push(itemText);
        i++;
      }
      blocks.push(
        <ol
          key={`numlist-${i}`}
          style={{
            margin: '0.65rem 0',
            paddingLeft: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            fontSize: '0.9375rem',
            lineHeight: 1.65,
          }}
        >
          {numItems.map((item, idx) => (
            <li key={idx} style={{ color: 'var(--text-primary)' }}>
              {parseInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Code Blocks (``` ... ```)
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) {
        i++;
      }
      blocks.push(
        <pre
          key={`code-${i}`}
          style={{
            margin: '1rem 0',
            padding: '1rem 1.25rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            overflowX: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
          }}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // 8. Standard Paragraph
    blocks.push(
      <p
        key={i}
        style={{
          margin: '0.55rem 0',
          fontSize: '0.9375rem',
          lineHeight: 1.7,
          color: 'var(--text-primary)',
        }}
      >
        {parseInline(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div className="markdown-content" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {blocks}
      {isStreaming && (
        <span
          className="animate-pulse-soft"
          style={{
            display: 'inline-block',
            width: '6px',
            height: '14px',
            background: 'var(--color-primary)',
            marginLeft: '4px',
            verticalAlign: 'middle',
            borderRadius: '1px',
          }}
        />
      )}
    </div>
  );
}
