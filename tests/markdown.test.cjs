const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const markdownit = require('../vendor/markdown-it.min.js');
const mathPlugin = require('../math-plugin.js');
const md = markdownit({ html: false, linkify: true }).use(mathPlugin);

test('supported math syntax and literal code retain their meaning', () => {
  const cases = [
    [String.raw`$x_1$`, 1], [String.raw`\(x_1\)`, 1],
    [String.raw`$$x_1$$`, 1], [String.raw`\[x_1\]`, 1],
    [String.raw`\begin{align}a&=b\\c&=d\end{align}`, 1],
    ['```latex\nx_1\n```', 1], ['`$x$`', 0],
    ['```js\n$x$\n```', 0], [String.raw`Costs $10 and $20.`, 0],
    [String.raw`\$x\$`, 0], ['- $$\n  x_1\n  $$', 1],
    ['> $$\n> x_1\n> $$', 1]
  ];
  for (const [source, count] of cases) {
    const env = { math: [] };
    md.render(source, env);
    assert.equal(env.math.length, count, source);
  }
});

test('image descriptions preserve math, formatting text and escaping', () => {
  const env = { math: [] };
  const html = md.render(String.raw`![**equation** $x^2$ and \(y_1\) and \[z\] and ${'`code`'}](image.png)`, env);
  assert.match(html, /alt="equation x\^2 and y_1 and z and code"/);
  assert.deepEqual(env.math, []);
  assert.match(md.render('![formula $"<>&$](image.png)'), /alt="formula &quot;&lt;&gt;&amp;"/);
  assert.match(md.render('![outer ![inner $x$](a.png)](b.png)'), /alt="outer inner x"/);
});

test('numeric bracket citations stay literal while explicit equations render', () => {
  for (const citation of ['1', '23', '1, 3', '2-5', '1, 3–5', '1; 4—6']) {
    for (const source of [String.raw`\[${citation}\]`, String.raw`See \[${citation}\] for details.`, `[${citation}]`]) {
      const env = { math: [] };
      const html = md.render(source, env);
      assert.deepEqual(env.math, [], source);
      assert(html.includes(`[${citation}]`), source);
    }
  }
  const env = { math: [] };
  const html = md.render(String.raw`See \[1\], then \[x^2\], $$1$$ and $1$.`, env);
  assert(html.includes('[1]'));
  assert.deepEqual(env.math.map(item => item.tex), ['x^2', '1', '1']);
  assert.match(md.render(String.raw`\[1\]` + '\n\n' + String.raw`\[x^2\]`), /<p>\[1\]<\/p>/);
  assert.match(md.render('`\\[1\\]`'), /<code>\\\[1\\\]<\/code>/);
});

test('raw HTML and unsafe links remain inert', () => {
  assert(!md.render('<script>alert(1)</script>').includes('<script>'));
  assert(!md.render('[click](javascript:alert(1))').includes('href='));
  assert(!md.render(String.raw`$<img src=x onerror="alert(1)">$`).includes('<img'));
});

test('crafted link finishes within a bounded time', () => {
  const bundle = path.resolve(__dirname, '../vendor/markdown-it.min.js');
  const result = spawnSync(process.execPath, ['-e', `
    const md = require(process.argv[1])({ linkify: true });
    md.render('http://example.com/' + '*'.repeat(100000) + 'a');
  `, bundle], { timeout: 5000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
