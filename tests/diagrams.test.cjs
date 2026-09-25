const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const fence = source => '```mermaid\n' + source + '\n```';

async function app(t, mermaid) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://example.test/', runScripts: 'outside-only', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  // jsdom has no layout engine; use deterministic SVG measurements for semantic checks.
  window.SVGElement.prototype.getBBox = function () {
    return { x: 0, y: 0, width: this.textContent.length * 8 || 100, height: 20 };
  };
  window.SVGElement.prototype.getComputedTextLength = function () { return this.textContent.length * 8; };
  for (const script of window.document.querySelectorAll('script[src]')) {
    const src = script.getAttribute('src');
    if (src.includes('mermaid') && mermaid !== undefined) { window.mermaid = mermaid; continue; }
    vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), dom.getInternalVMContext());
  }
  await window.MathJax.startup.promise;
  const document = window.document;
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  const status = document.querySelector('#render-status');
  const pdf = document.querySelector('#download-pdf');
  function render(source) {
    editor.value = source;
    editor.dispatchEvent(new window.Event('input'));
    window.dispatchEvent(new window.Event('beforeprint'));
  }
  return { window, document, editor, preview, status, pdf, render };
}

async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail('Rendering did not finish');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

test('the proposal renders citations, the flowchart and the LaTeX loss together', async t => {
  const { render, preview, status, document } = await app(t);
  render(fs.readFileSync(path.join(__dirname, 'fixtures/distribution-head.md'), 'utf8'));
  await until(() => status.textContent !== 'Rendering diagrams…');
  assert.equal(status.textContent, 'Up to date');
  assert.match(preview.textContent, /LLM Processes \[1\] and amortized inference models \[3\]/);
  assert.equal(preview.querySelectorAll('mjx-container').length, 1);
  assert.equal(preview.querySelectorAll('.diagram svg').length, 1);
  assert.equal(preview.querySelectorAll('.diagram .node').length, 7);
  const labels = [...preview.querySelectorAll('.diagram .node text')].map(node => node.textContent);
  assert(labels.some(label => /one\s*forward\s*pass/.test(label)), JSON.stringify(labels));
  assert.equal(preview.querySelectorAll('foreignObject').length, 0);
  assert.equal(document.querySelectorAll('.diagram-stage').length, 0);
});

test('invalid diagrams preserve source and recover on the next edit', async t => {
  const { render, preview, status, document } = await app(t);
  render(fence('flowchart LR\nA[unfinished'));
  await until(() => status.textContent !== 'Rendering diagrams…');
  assert.equal(status.textContent, '1 diagram to check');
  assert.match(preview.querySelector('code').textContent, /A\[unfinished/);
  assert(preview.querySelector('.diagram-error-message'));
  assert.equal(document.querySelectorAll('.diagram-stage').length, 0);
  render(fence('flowchart LR\nA --> B'));
  await until(() => status.textContent !== 'Rendering diagrams…');
  assert.equal(status.textContent, 'Up to date');
  assert(preview.querySelector('.diagram svg'));
});

test('diagram input cannot enable HTML labels or click actions', async t => {
  const { render, preview, status, window } = await app(t);
  render(fence(`%%{init: {"securityLevel": "loose", "htmlLabels": true, "flowchart": {"htmlLabels": true}}}%%
flowchart LR
A["<img src=x onerror=alert(1)>"] --> B[Safe]
click B "javascript:alert(1)"`));
  await until(() => status.textContent !== 'Rendering diagrams…');
  assert.equal(status.textContent, 'Up to date');
  assert(preview.querySelector('.diagram svg'));
  assert.equal(preview.querySelectorAll('img, script, foreignObject, [onclick], [onerror], a[href], a[xlink\\:href]').length, 0);
  assert.equal(window.mermaid.mermaidAPI.getConfig().securityLevel, 'strict');
  assert.equal(window.mermaid.mermaidAPI.getConfig().htmlLabels, false);
});

test('a completed stale diagram cannot replace a cleared or newer document', async t => {
  const pending = [];
  const { render, preview, status, document, pdf } = await app(t, {
    initialize() {}, render: () => new Promise(resolve => pending.push(resolve))
  });
  render(fence('flowchart LR\nA --> B'));
  await until(() => pending.length === 1);
  document.querySelector('#clear-document').click();
  pending.shift()({ svg: '<svg><text>Old diagram</text></svg>' });
  await until(() => document.querySelectorAll('.diagram-stage').length === 0);
  assert.equal(preview.textContent, '');
  assert.equal(status.textContent, 'Up to date');
  assert.equal(pdf.disabled, false);

  render(fence('flowchart LR\nC --> D'));
  await until(() => pending.length === 1);
  render('# New document');
  pending.shift()({ svg: '<svg><text>Stale diagram</text></svg>' });
  await until(() => document.querySelectorAll('.diagram-stage').length === 0);
  assert.equal(preview.querySelector('h1').textContent, 'New document');
  assert.equal(preview.querySelector('svg'), null);
});

test('PDF export waits for diagrams when clicked before the preview debounce', async t => {
  let finish;
  const { editor, window, pdf, preview } = await app(t, {
    initialize() {}, render: () => new Promise(resolve => { finish = resolve; })
  });
  let printed = false;
  window.print = () => { printed = true; assert(preview.querySelector('.diagram svg')); };
  editor.value = fence('flowchart LR\nA --> B');
  editor.dispatchEvent(new window.Event('input'));
  pdf.click();
  await until(() => finish);
  assert.equal(printed, false);
  finish({ svg: '<svg><text>Diagram</text></svg>' });
  await until(() => printed);
});

test('a missing Mermaid library leaves a readable source and error', async t => {
  const { render, preview, status } = await app(t, null);
  render(fence('flowchart LR\nA --> B'));
  await until(() => status.textContent !== 'Rendering diagrams…');
  assert.equal(status.textContent, '1 diagram to check');
  assert.match(preview.textContent, /rendering is unavailable/);
  assert.match(preview.querySelector('code').textContent, /A --> B/);
});

test('PDF export waits for the latest document when diagrams change during rendering', async t => {
  const pending = [];
  const { editor, window, pdf, preview, render } = await app(t, {
    initialize() {}, render: () => new Promise(resolve => pending.push(resolve))
  });
  let printed = false;
  window.print = () => { printed = true; assert.match(preview.textContent, /Latest diagram/); };
  editor.value = fence('flowchart LR\nA --> B');
  editor.dispatchEvent(new window.Event('input'));
  pdf.click();
  await until(() => pending.length === 1);
  render(fence('flowchart LR\nC --> D'));
  await until(() => pending.length === 2);
  pending.shift()({ svg: '<svg><text>Old diagram</text></svg>' });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(printed, false);
  pending.shift()({ svg: '<svg><text>Latest diagram</text></svg>' });
  await until(() => printed);
});
