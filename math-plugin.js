/* Preserve TeX before Markdown consumes backslashes, underscores, or line breaks. */
(function (root) {
  'use strict';
  function mathPlugin(md) {
    const escape = md.utils.escapeHtml;
    const environments = /^(?:equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|displaymath|eqnarray\*?|split|aligned|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases)$/;
    function escaped(src, pos) {
      let count = 0;
      while (pos > 0 && src[--pos] === '\\') count++;
      return count % 2 === 1;
    }
    function closing(src, marker, start) {
      let end = start;
      while ((end = src.indexOf(marker, end)) !== -1) {
        if (!escaped(src, end)) return end;
        end += marker.length;
      }
      return -1;
    }
    function isCitation(content) {
      return /^\s*\d+(?:\s*[-–—]\s*\d+)?(?:\s*[,;]\s*\d+(?:\s*[-–—]\s*\d+)?)*\s*$/.test(content);
    }
    function placeholder(tex, display, env) {
      env.math = env.math || [];
      const id = env.math.push({ tex, display }) - 1;
      const tag = display ? 'div' : 'span';
      return '<' + tag + ' class="math-' + (display ? 'display' : 'inline') + '" data-math="' + id + '">' + escape(tex) + '</' + tag + '>';
    }
    md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const first = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine]);
      let open, close, keep = false;
      if (first.startsWith('$$')) { open = '$$'; close = '$$'; }
      else if (first.startsWith('\\[')) { open = '\\['; close = '\\]'; }
      else {
        const match = first.match(/^\\begin\{([^}]+)\}/);
        if (!match || !environments.test(match[1])) return false;
        open = match[0]; close = '\\end{' + match[1] + '}'; keep = true;
      }
      let line = startLine, pos = closing(first, close, open.length);
      let raw = first;
      while (pos < 0 && line + 1 < endLine) {
        line++;
        // Do not let an unclosed block consume the rest of a list or quotation.
        if (state.sCount[line] < state.blkIndent && !state.isEmpty(line)) return false;
        const text = state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
        raw += '\n' + text;
        pos = closing(raw, close, open.length);
      }
      if (pos < 0 || raw.slice(pos + close.length).trim()) return false;
      if (open === '\\[' && isCitation(raw.slice(open.length, pos))) return false;
      if (silent) return true;
      const token = state.push('math_block', '', 0);
      token.content = keep ? raw.slice(0, pos + close.length) : raw.slice(open.length, pos);
      token.map = [startLine, line + 1];
      state.line = line + 1;
      return true;
    }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
    md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
      const pos = state.pos, src = state.src;
      let open, close, display = false;
      if (src.startsWith('\\(', pos)) { open = '\\('; close = '\\)'; }
      else if (src.startsWith('\\[', pos)) { open = '\\['; close = '\\]'; display = true; }
      else if (src.startsWith('$$', pos)) { open = close = '$$'; display = true; }
      else if (src[pos] === '$' && !/\s/.test(src[pos + 1] || ' ')) { open = close = '$'; }
      else return false;
      let end = closing(src, close, pos + open.length);
      if (close === '$') {
        while (end >= 0 && (/\s/.test(src[end - 1]) || /\d/.test(src[end + 1] || ''))) end = closing(src, close, end + 1);
      }
      if (end < 0 || end === pos + open.length) return false;
      const content = src.slice(pos + open.length, end);
      if (open === '\\[' && isCitation(content)) return false;
      if (!display && content.includes('\n')) return false;
      if (!silent) {
        const token = state.push('math_inline', '', 0);
        token.content = content;
        token.meta = { display };
      }
      state.pos = end + close.length;
      return true;
    });
    md.renderer.rules.math_block = (tokens, idx, options, env) => placeholder(tokens[idx].content, true, env) + '\n';
    md.renderer.rules.math_inline = (tokens, idx, options, env) => {
      // Keep valid paragraph markup for display math written inside a paragraph.
      if (tokens[idx].meta.display) return placeholder(tokens[idx].content, true, env).replace(/^<div /, '<span ').replace(/<\/div>$/, '</span>');
      return placeholder(tokens[idx].content, false, env);
    };
    // Image descriptions include plain TeX; the image renderer escapes attributes.
    const renderInlineAsText = md.renderer.renderInlineAsText;
    md.renderer.renderInlineAsText = function (tokens, options, env) {
      return renderInlineAsText.call(this, tokens.map(token =>
        token.type === 'math_inline' ? { ...token, type: 'text' } : token
      ), options, env);
    };
    const fence = md.renderer.rules.fence;
    md.renderer.rules.fence = (tokens, idx, options, env, self) => {
      if (/^(math|tex|latex)$/i.test(tokens[idx].info.trim())) return placeholder(tokens[idx].content, true, env) + '\n';
      return fence(tokens, idx, options, env, self);
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = mathPlugin;
  else root.mathPlugin = mathPlugin;
})(typeof window !== 'undefined' ? window : globalThis);
