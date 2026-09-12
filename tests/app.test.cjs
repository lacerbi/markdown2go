const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');

test('math rendering follows the current document and reports invalid commands', async t => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://example.test/markdown2go/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  for (const script of document.querySelectorAll('script[src]')) {
    window.eval(fs.readFileSync(path.join(root, script.getAttribute('src')), 'utf8'));
  }
  await window.MathJax.startup.promise;
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  const status = document.querySelector('#render-status');
  function render(source) {
    editor.value = source;
    editor.dispatchEvent(new window.Event('input'));
    window.dispatchEvent(new window.Event('beforeprint'));
  }
  function mathText() {
    return [...preview.querySelectorAll('mjx-assistive-mml')].map(node => node.textContent).join('');
  }

  render(String.raw`$\newcommand{\foo}{A}$ and $\foo$`);
  assert.equal(status.textContent, 'Up to date');
  assert.equal(preview.querySelectorAll('mjx-container svg').length, 2);
  assert.match(mathText(), /A/);

  render(String.raw`$\foo$`);
  assert.equal(status.textContent, '1 equation to check');
  assert(preview.querySelector('[data-mjx-error]'));

  render(String.raw`$\newcommand{\foo}{B}$ and $\foo$`);
  assert.equal(status.textContent, 'Up to date');
  assert.match(mathText(), /B/);
  document.querySelector('#clear-document').click();
  assert.equal(editor.value, '');
  assert.equal(preview.textContent, '');
  render(String.raw`$\foo$`);
  assert.equal(status.textContent, '1 equation to check');

  render(String.raw`$\newenvironment{demo}{A}{B}$ and $\begin{demo}x\end{demo}$`);
  assert.equal(status.textContent, 'Up to date');
  assert.match(mathText(), /AxB/);
  render(String.raw`$\begin{demo}x\end{demo}$`);
  assert.equal(status.textContent, '1 equation to check');

  render(String.raw`$\typo$ and $\anotherTypo$ and $x^2$`);
  assert.equal(status.textContent, '2 equations to check');
  render(String.raw`$x^2$`);
  assert.equal(status.textContent, 'Up to date');
  assert.equal(document.querySelector('#download-pdf').disabled, false);
  assert(document.querySelector('#MJX-SVG-styles'));
  assert([...document.querySelectorAll('style')].some(style =>
    style.textContent.includes('mjx-assistive-mml') && style.textContent.includes('clip:')
  ));

  render('example.com and user@example.com');
  assert.equal(preview.querySelectorAll('a').length, 2);
  for (const link of preview.querySelectorAll('a')) {
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
  }
  assert.deepEqual(errors, []);
});
