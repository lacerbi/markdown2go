# Repository Guidelines

## Project Structure & Module Organization

Markdown to Go is a static Markdown editor with a live MathJax preview. Source files live at the repository root:

- `index.html` defines the workspace and script loading order.
- `app.js` handles editing, preview updates, filenames, downloads, and printing.
- `math-plugin.js` preserves TeX through markdown-it parsing; `mathjax-config.js` configures rendering.
- `styles.css` contains layout, typography, responsive styles, and print rules; `favicon.svg` provides the icon.
- `vendor/` contains pinned browser libraries and their licenses.
- `tests/` contains parser and application tests.

## Build, Test, and Development Commands

- Open `index.html` directly in a modern desktop browser to run locally. No server or build step is required.
- `npm ci` installs development dependencies from `package-lock.json`. Use Node.js 22.12+ or 24+, as documented in the README.
- `npm test` runs all tests through `node --test tests/*.test.cjs`.
- `node --test tests/markdown.test.cjs` runs parser checks alone.

Runtime libraries are included locally; npm dependencies are needed only for development.

## Coding Style & Naming Conventions

Match surrounding code: use two-space JavaScript indentation, semicolons, single-quoted strings, and camelCase function and variable names. Use kebab-case for HTML IDs, CSS classes, and multiword filenames. Tests use CommonJS imports and the `.test.cjs` suffix. Preserve the compact CSS formatting when making focused edits. No formatter or lint command is configured.

## Testing Guidelines

Tests use Node's built-in test runner and strict assertions; application tests use jsdom and the vendored MathJax bundle. Give tests descriptive behavior-based names and add regression cases for parsing or rendering fixes. Cover literal code, math delimiters, unsafe input, and document state resets where relevant. No numerical coverage threshold is configured.

Run `npm test` for code changes. Check desktop/mobile layout and PDF pagination manually in a browser when changing presentation or export behavior.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects, such as `Widen the document title field`. Follow that style and keep changes focused. PR descriptions should explain the user-visible behavior and validation performed, link related issues when applicable, and include screenshots for visual changes.

## Security & Dependency Updates

Keep document processing in the browser, raw HTML disabled, and TeX packages restricted. Update vendored libraries from official packages, preserve their licenses, and recheck math parsing and exports.
