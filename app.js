/* No server, framework, or build step. All document processing stays in the tab. */
(() => {
  'use strict';
  const editor = document.querySelector('#editor');
  const preview = document.querySelector('#preview');
  const status = document.querySelector('#render-status');
  const pdfButton = document.querySelector('#download-pdf');
  const filename = document.querySelector('#filename');
  const toast = document.querySelector('#toast');
  let timer, toastTimer, mathReady = false, renderedSource = null;
  let renderVersion = 0, diagramId = 0, pendingRender = Promise.resolve();
  editor.value = '';
  let md;
  function notify(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5500);
  }
  function documentName() {
    return (filename.value.trim().replace(/\.md$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '') || 'untitled').slice(0, 100);
  }
  function nameFromOpeningHeading() {
    if (!md || filename.value.trim().toLowerCase() !== 'untitled') return;
    const firstLine = editor.value.replace(/^\uFEFF/, '').split(/\r?\n/).find(line => line.trim()) || '';
    const heading = firstLine.match(/^ {0,3}#{1,6}(?:[ \t]+|$)(.*)$/);
    if (!heading) return;
    const source = heading[1].replace(/[ \t]+#+[ \t]*$/, '');
    const inlineText = tokens => tokens.map(token => {
      if (token.children) return inlineText(token.children);
      return ['text', 'code_inline', 'math_inline'].includes(token.type) ? token.content : '';
    }).join('');
    const text = inlineText(md.parseInline(source, {}))
      .normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/['’]/g, '');
    const words = text.match(/[\p{L}\p{N}]+/gu) || [];
    const name = words.slice(0, 5).join('-').slice(0, 100).replace(/-+$/, '');
    if (name) filename.value = name;
  }
  function count() {
    const text = editor.value.trim();
    const words = text ? text.split(/\s+/u).length : 0;
    document.querySelector('#counts').textContent = `${words.toLocaleString()} words · ${editor.value.length.toLocaleString()} characters`;
  }
  function renderStatus(errors, diagramErrors) {
    const messages = [];
    if (errors) messages.push(`${errors} equation${errors === 1 ? '' : 's'} to check`);
    if (diagramErrors) messages.push(`${diagramErrors} diagram${diagramErrors === 1 ? '' : 's'} to check`);
    return messages.join(', ') || (mathReady ? 'Up to date' : 'Math unavailable');
  }
  async function renderDiagrams(nodes, version, errors, hasMath) {
    let diagramErrors = 0;
    if (document.fonts) await document.fonts.ready;
    for (const node of nodes) {
      if (version !== renderVersion) return;
      const stage = document.createElement('div');
      stage.className = 'diagram-stage';
      stage.setAttribute('aria-hidden', 'true');
      document.body.appendChild(stage);
      try {
        const { svg } = await window.mermaid.render('diagram-' + ++diagramId, node.textContent, stage);
        if (version !== renderVersion) return;
        const diagram = document.createElement('div');
        diagram.className = 'diagram';
        diagram.innerHTML = svg;
        node.parentElement.replaceWith(diagram);
      } catch (error) {
        if (version !== renderVersion) return;
        diagramErrors++;
        node.parentElement.classList.add('diagram-error');
        const message = document.createElement('p');
        message.className = 'diagram-error-message';
        message.textContent = window.mermaid ? 'Diagram could not render. Check its Mermaid syntax.' : 'Diagram rendering is unavailable. Reload the page to try again.';
        node.parentElement.before(message);
      } finally {
        stage.remove();
      }
    }
    if (version !== renderVersion) return;
    status.textContent = renderStatus(errors, diagramErrors);
    pdfButton.disabled = !mathReady && hasMath;
  }
  function render() {
    clearTimeout(timer);
    count();
    if (!md) return;
    const source = editor.value;
    if (source === renderedSource) return pendingRender;
    const version = ++renderVersion;
    const scroll = preview.parentElement.scrollTop;
    const env = { math: [] };
    try {
      const fragment = document.createElement('div');
      fragment.innerHTML = source.trim() ? md.render(source, env) : '';
      let errors = 0;
      if (mathReady) {
        // Replay each document with fresh TeX definitions and equation numbering.
        MathJax.startup.input = MathJax.startup.getInputJax();
        MathJax.startup.document = MathJax.startup.getDocument();
        MathJax.startup.makeMethods();
        fragment.querySelectorAll('[data-math]').forEach(node => {
          const item = env.math[Number(node.dataset.math)];
          try {
            const svg = MathJax.tex2svg(item.tex, { display: item.display });
            if (svg.querySelector('[data-mjx-error]')) errors++;
            node.replaceChildren(svg);
          } catch (error) {
            errors++;
            node.classList.add('math-error');
            node.title = 'Check this equation’s LaTeX syntax.';
          }
        });
      }
      fragment.querySelectorAll('a').forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
      preview.replaceChildren(...fragment.childNodes);
      preview.parentElement.scrollTop = scroll;
      status.textContent = renderStatus(errors, 0);
      renderedSource = source;
      pdfButton.disabled = !mathReady && env.math.length > 0;
      const diagrams = [...preview.querySelectorAll('pre > code.language-mermaid')];
      pendingRender = Promise.resolve();
      if (diagrams.length) {
        status.textContent = 'Rendering diagrams…';
        pdfButton.disabled = true;
        pendingRender = renderDiagrams(diagrams, version, errors, env.math.length > 0);
      }
    } catch (error) {
      status.textContent = 'Preview could not render';
      pdfButton.disabled = true;
    }
    return pendingRender;
  }
  document.querySelector('#download-md').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([editor.value], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = documentName() + '.md';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Markdown download started.');
  });
  pdfButton.addEventListener('click', async () => {
    let version;
    do {
      const rendering = render();
      version = renderVersion;
      await rendering;
      if (version === renderVersion && pdfButton.disabled) return;
    } while (version !== renderVersion || renderedSource !== editor.value);
    if (pdfButton.disabled) return;
    // Wait for user-linked images so print does not silently omit slow images.
    pdfButton.disabled = true;
    const pendingImages = [...preview.querySelectorAll('img')].filter(image => !image.complete);
    if (pendingImages.length) notify('Preparing images for your PDF…');
    const loaded = await Promise.race([
      Promise.all(pendingImages.map(image => new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      }))).then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 8000))
    ]);
    pdfButton.disabled = false;
    if (!loaded) { notify('Some images are still loading. Please try exporting again in a moment.'); return; }
    if ([...preview.querySelectorAll('img')].some(image => !image.naturalWidth)) {
      notify('An image could not load. Check its URL before exporting.'); return;
    }
    if (document.fonts) await document.fonts.ready;
    if (version !== renderVersion || renderedSource !== editor.value) {
      notify('The document changed while preparing your PDF. Please export again.');
      return;
    }
    const title = document.title;
    document.title = documentName();
    window.print();
    document.title = title;
  });
  window.addEventListener('beforeprint', render);
  editor.addEventListener('paste', () => {
    // Let the browser insert the clipboard text before reading the opening line.
    setTimeout(nameFromOpeningHeading, 0);
  });
  document.querySelector('#clear-document').addEventListener('click', () => {
    editor.value = '';
    filename.value = 'untitled';
    renderedSource = null;
    clearTimeout(toastTimer);
    toast.hidden = true;
    render();
    editor.scrollTop = 0;
    preview.parentElement.scrollTop = 0;
    editor.focus({ preventScroll: true });
  });
  editor.addEventListener('input', () => {
    count();
    status.textContent = 'Updating…';
    clearTimeout(timer);
    timer = setTimeout(render, 220);
  });
  document.querySelectorAll('[data-view]').forEach(button => {
    if (button.tagName !== 'BUTTON') return;
    button.addEventListener('click', () => {
      document.querySelector('#workspace').dataset.view = button.dataset.view;
      document.querySelectorAll('button[data-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    });
  });
  const infoButton = document.querySelector('#info-button');
  const infoPanel = document.querySelector('#info-panel');
  function setInfo(open) {
    infoButton.setAttribute('aria-expanded', String(open));
    infoPanel.hidden = !open;
  }
  infoButton.addEventListener('click', () => setInfo(infoPanel.hidden));
  document.addEventListener('click', event => {
    if (!event.target.closest('.info')) setInfo(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !infoPanel.hidden) {
      setInfo(false);
      infoButton.focus();
    }
  });
  try {
    md = window.markdownit({ html: false, linkify: true, typographer: false }).use(window.mathPlugin);
    md.linkify.set({ fuzzyLink: true });
  } catch (error) {
    status.textContent = 'Markdown could not load';
    preview.textContent = 'The Markdown library could not load. Reload this page to try again. Your source is still available to download.';
    count();
    return;
  }
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      htmlLabels: false,
      fontFamily: 'Arial, sans-serif',
      secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges',
        'suppressErrorRendering', 'htmlLabels', 'flowchart', 'fontFamily', 'themeCSS']
    });
  }
  render();
  if (window.MathJax?.startup?.promise) {
    status.textContent = 'Loading MathJax…';
    MathJax.startup.promise.then(() => {
      // tex2svg() returns equation nodes but does not install document styles.
      // These styles visually hide assistive MathML while preserving screen-reader access.
      MathJax.startup.document.updateDocument();
      mathReady = true; renderedSource = null; render();
    }).catch(() => {
      status.textContent = 'Math could not load';
      notify('MathJax could not load. Download your Markdown to keep it, then reload this page.');
    });
  } else {
    notify('MathJax could not load. Try reloading the page.');
  }
})();
