# Markdown to Go

A small, portable Markdown editor with a live MathJax preview. Plain HTML, CSS, and JavaScript: no framework, npm install, compilation, API key, or backend required.

## Run it

In the downloadable source ZIP, open `index.html` directly in a modern desktop browser. All JavaScript libraries are included in `vendor/`; the editor itself does not need a CDN. In the original Sites checkout, the same files live in `dist/`.

You can also serve the folder with any static web server. For example, from the extracted ZIP:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Put it on GitHub Pages

1. Create a GitHub repository and upload the **contents** of the extracted source folder. `index.html`, `.nojekyll`, `app.js`, `styles.css`, and the `vendor` folder should be at the repository root. Include the license files too.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select **main** and **/(root)**, then **Save**.
5. GitHub will show the website address when publishing finishes.

All asset paths are relative, so both `username.github.io` and `username.github.io/repository-name/` work without editing the code. This folder can also be hosted by any other static host.

[GitHub’s publishing instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Use it

- Paste or type Markdown in the editor. The preview updates after a short debounce.
- When the filename is `untitled`, pasting a document that starts with a `#`–`######` heading sets the filename from its first five words, lowercase and hyphen-separated. Existing filenames are preserved.
- **Clear** empties the document and resets the filename to `untitled`.
- Switch between Editor, Split, and Preview. On narrow screens the split panes stack vertically.
- Change the document name at the top, then use **Download .md** to download the exact source, including the original math delimiters.
- Use **Export PDF**, then choose **Save as PDF** in the browser’s print dialog. The print stylesheet includes only the rendered document. Disable the browser’s **Headers and footers** setting for a clean page. Choose A4 or Letter and your preferred margins in that dialog.
- Source exists only in the open tab; download it before closing or reloading. No analytics, server processing, account system, or automatic document storage is included. Images linked in your Markdown are requested directly from their URLs.

## Supported syntax

| Kind | Syntax |
| --- | --- |
| Inline math | `$x^2$` or `\(x^2\)` |
| Display math | `$$x^2$$` or `\[x^2\]`, including multiline blocks |
| Environments | Standalone `equation`, `align`, `alignat`, `gather`, `multline`, matrices, `cases`, and starred variants where supported by MathJax |
| Math code fences | Fences labeled `math`, `tex`, or `latex` |
| Literal dollar sign | `\$` |
| Ordinary Markdown | Headings, emphasis, links, images, lists, blockquotes, horizontal rules, tables, strikethrough, and code blocks |

Inline code and ordinary code fences are preserved literally. Single-dollar inline math cannot begin or end with whitespace; a closing dollar sign followed by a digit is treated as currency. Use `\(...\)` when text containing dollar signs is ambiguous.

This is a Markdown/TeX editor, not a full LaTeX document compiler. Raw HTML is displayed as text. MathJax uses the `base`, `ams`, and `newcommand` packages; arbitrary package loading and HTML-producing TeX extensions are disabled. Custom macros can be declared with `\newcommand` and apply to subsequent equations in the current document. Undefined commands are reported as equation errors. Math in image descriptions is preserved as plain TeX.

## How it works

- `index.html` — the workspace and document storage information.
- `styles.css` — desktop/mobile layout, document typography, and print rules.
- `app.js` — editing, preview updates, file download, and printing.
- `math-plugin.js` — markdown-it rules that preserve TeX before Markdown handles backslashes and underscores.
- `mathjax-config.js` — MathJax configuration.
- `vendor/markdown-it.min.js` — markdown-it 15.0.2, MIT license.
- `vendor/tex-svg-full.js` — MathJax 3.2.2, Apache 2.0 license. SVG output embeds equation shapes for crisp printing without webfont dependencies.

The libraries are pinned and included locally. To update them, replace the files from their official packages, preserve their licenses, and recheck math parsing and exports.

References: [markdown-it options](https://markdown-it.github.io/markdown-it/interfaces/MarkdownItOptions.html), [MathJax configuration](https://docs.mathjax.org/en/v3.2/web/configuration.html).

## Development checks

With Node.js 22.12+ or 24+ installed, run `npm ci` and `npm test`. The tests check Markdown parsing, image descriptions, unsafe input, and MathJax rendering across document edits and clears. Node.js and the test dependencies are only needed for development. Browser layout and PDF pagination should also be checked in a browser.

## PDF scope

PDF export uses the browser’s native print engine; it opens a dialog instead of silently downloading a PDF. Equations are SVG and document text remains selectable. Pagination can vary by browser, page size, and font. Very wide tables, long code lines, and oversized equations may require landscape orientation or a lower print scale. A fully automatic PDF download would require an additional PDF-generation library or service.
