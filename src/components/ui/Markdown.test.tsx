import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Markdown } from './Markdown';

const html = (md: string) => renderToStaticMarkup(<Markdown source={md} />);

describe('Markdown', () => {
  it('renders headings (from h2), paragraphs, lists, quotes and code', () => {
    const out = html('# Title\n\nFirst line\nsame paragraph.\n\n- one\n- two\n\n1. a\n2. b\n\n> careful\n\n```\nconst x = 1 < 2;\n```');
    expect(out).toBe(
      '<h2>Title</h2><p>First line same paragraph.</p><ul><li>one</li><li>two</li></ul><ol><li>a</li><li>b</li></ol><blockquote>careful</blockquote><pre><code>const x = 1 &lt; 2;</code></pre>',
    );
  });

  it('renders bold, italic, inline code and safe links', () => {
    expect(html('**Image** the *disk* with `ddrescue`, see [guide](https://example.com/g) or [contact](/contact).')).toBe(
      '<p><strong>Image</strong> the <em>disk</em> with <code>ddrescue</code>, see <a href="https://example.com/g" target="_blank" rel="noopener noreferrer">guide</a> or <a href="/contact">contact</a>.</p>',
    );
  });

  it('allows balanced parentheses in URLs', () => {
    expect(html('[RAID](https://en.wikipedia.org/wiki/RAID_(computing))')).toBe(
      '<p><a href="https://en.wikipedia.org/wiki/RAID_(computing)" target="_blank" rel="noopener noreferrer">RAID</a></p>',
    );
  });

  it('never outputs raw HTML from the source', () => {
    const out = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('drops unsafe link targets but keeps their text', () => {
    for (const href of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//evil.example', 'vbscript:x']) {
      const out = html(`[click](${href})`);
      expect(out).toBe('<p>click</p>');
    }
  });
});
