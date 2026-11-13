import type { ReactNode } from 'react';

/**
 * Minimal, safe Markdown → React for blog posts (docs/SECURITY.md: no raw HTML).
 * Builds elements instead of HTML strings, so markup in the text is shown as text, never executed.
 * Supports: # headings (2–4 levels used), paragraphs, - / 1. lists, > quotes, ``` code blocks,
 * **bold**, *italic*, `code`, [links](https://…).
 */

const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Order matters: code first (its content isn't formatted), then links (one level of balanced
  // parentheses allowed in URLs, e.g. …/RAID_(computing)), bold, italic.
  const pattern = /(`[^`]+`)|(\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1]) out.push(<code key={key}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) {
      const href = m[4];
      out.push(
        SAFE_URL.test(href) ? (
          <a key={key} href={href} {...(/^https?:/i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {inline(m[3], key)}
          </a>
        ) : (
          m[3]
        ),
      );
    } else if (m[5]) out.push(<strong key={key}>{inline(m[6], key)}</strong>);
    else if (m[7]) out.push(<em key={key}>{inline(m[8], key)}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${k++}`;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i += 1; // closing fence
      blocks.push(
        <pre key={key}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      // The page h1 is the post title: # and ## both become h2, ### h3, #### h4.
      const level = Math.min(4, Math.max(2, heading[1].length));
      const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={key}>{inline(heading[2], key)}</Tag>);
      i += 1;
      continue;
    }

    if (/^\s*([-*])\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      const itemRe = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      while (i < lines.length && itemRe.test(lines[i])) items.push(itemRe.exec(lines[i++])![1]);
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key}>
          {items.map((item, j) => (
            <li key={j}>{inline(item, `${key}-${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }

    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key}>{inline(quote.join(' '), key)}</blockquote>);
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|>|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])
    ) {
      para.push(lines[i++].trim());
    }
    blocks.push(<p key={key}>{inline(para.join(' '), key)}</p>);
  }

  return <>{blocks}</>;
}
