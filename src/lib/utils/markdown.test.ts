import { describe, expect, it } from 'vitest';
import { preprocessLaTeX, renderMarkdown, speechText } from './markdown';

/**
 * Model output is untrusted: it comes from whichever endpoint the user points
 * at and can be steered by prompt injection. It is rendered with {@html}, so
 * anything that survives here executes in the app's origin, next to the stored
 * conversations and API key.
 */
describe('renderMarkdown sanitisation', () => {
  it('strips script tags', () => {
    const out = renderMarkdown('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips inline event handlers', () => {
    const out = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('strips javascript: URLs', () => {
    const out = renderMarkdown('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
  });

  it('strips iframes', () => {
    const out = renderMarkdown('<iframe src="https://evil.example"></iframe>');
    expect(out).not.toContain('<iframe');
  });

  it('strips svg animation handlers', () => {
    const out = renderMarkdown(
      '<svg><animate onbegin=alert(1) attributeName=x dur=1s>'
    );
    expect(out).not.toContain('onbegin');
  });

  it('resists the mglyph/style mutation vector', () => {
    const out = renderMarkdown(
      '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'
    );
    expect(out).not.toContain('onerror');
  });

  it('leaves ordinary markdown intact', () => {
    const out = renderMarkdown('Some **bold** and _italic_ text');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
  });

  it('keeps links, without the dangerous scheme', () => {
    const out = renderMarkdown('[docs](https://example.com)');
    expect(out).toContain('href="https://example.com"');
  });
});

describe('renderMarkdown structure', () => {
  it('wraps code blocks with a copy button carrying the source', () => {
    const out = renderMarkdown('```js\nconst x = 1;\n```');
    expect(out).toContain('class="code-block"');
    expect(out).toContain('data-lang="js"');
    // the copy button's payload must survive sanitisation, or copying breaks
    expect(out).toContain('data-code=');
    expect(out).toContain('const x = 1;');
  });

  it('escapes markup inside code blocks rather than rendering it', () => {
    const out = renderMarkdown('```\n<script>alert(1)</script>\n```');
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('wraps tables so they can scroll', () => {
    const out = renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |');
    expect(out).toContain('class="table-wrapper"');
    expect(out).toContain('<th>a</th>');
    expect(out).toContain('<td>1</td>');
  });

  it('renders math, keeping the TeX annotation KaTeX emits', () => {
    const out = renderMarkdown('$x^2$');
    expect(out).toContain('katex');
    expect(out).toContain('<annotation');
    expect(out).toContain('encoding="application/x-tex"');
  });
});

describe('preprocessLaTeX', () => {
  it('escapes a bare $ before a number so prices are not read as math', () => {
    expect(preprocessLaTeX('costs $5 today')).toBe('costs \\$5 today');
  });

  it('treats a purely numeric $...$ span as currency, not math', () => {
    // The numeric guard declines to protect it as LaTeX, so the following
    // escape pass makes the leading $ literal.
    expect(preprocessLaTeX('$100$')).toBe('\\$100$');
  });

  it('preserves math expressions', () => {
    expect(preprocessLaTeX('$x^2$')).toBe('$x^2$');
    expect(preprocessLaTeX('$$a+b$$')).toBe('$$a+b$$');
  });

  it('does not touch dollar signs inside code spans or blocks', () => {
    expect(preprocessLaTeX('`echo $5`')).toBe('`echo $5`');
    expect(preprocessLaTeX('```\ncost $5\n```')).toBe('```\ncost $5\n```');
  });
});

describe('preparing a message to be read aloud', () => {
  it('drops the markers around emphasis and headings', () => {
    const spoken = speechText('## Heading\n\nSome **bold** and *italic* text.');

    // Spoken as markdown this announces every hash and asterisk.
    expect(spoken).toBe('Heading Some bold and italic text.');
  });

  it('reads a link by its text, not its address', () => {
    expect(speechText('See [the docs](https://example.com) please.')).toBe(
      'See the docs please.'
    );
  });

  it('leaves out the code block toolbar', () => {
    const spoken = speechText('Before.\n\n```js\nconst x = 1;\n```\n\nAfter.');

    // The language tag and the copy button's label sit inside the rendered
    // block; read straight through, the message says "js Copy".
    expect(spoken).not.toContain('Copy');
    expect(spoken).not.toMatch(/\bjs\b/);
  });

  it('still reads the code itself', () => {
    const spoken = speechText('Before.\n\n```js\nconst x = 1;\n```\n\nAfter.');

    expect(spoken).toContain('const x = 1;');
    expect(spoken).toContain('Before.');
    expect(spoken).toContain('After.');
  });

  it('reads a formula once rather than three times', () => {
    const spoken = speechText('Einstein said $E = mc^2$ once.');

    // KaTeX writes the formula as characters, as its original TeX inside the
    // MathML, and again as the visible glyphs.
    expect(spoken).toBe('Einstein said E=mc2 once.');
  });

  it('collapses the gaps between blocks', () => {
    expect(speechText('One.\n\n\nTwo.\n\n- a\n- b')).toBe('One. Two. a b');
  });

  it('has nothing to say about an empty message', () => {
    expect(speechText('')).toBe('');
  });
});
