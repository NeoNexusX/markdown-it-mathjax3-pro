# markdown-it-mathjax3-pro

[![CI](https://github.com/NeoNexusX/markdown-it-mathjax3-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/NeoNexusX/markdown-it-mathjax3-pro/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/markdown-it-mathjax3-pro.svg)](https://www.npmjs.com/package/markdown-it-mathjax3-pro)
[![license](https://img.shields.io/npm/l/markdown-it-mathjax3-pro.svg)](./LICENSE)

A markdown-it plugin for MathJax 3 that supports both server-side rendering (SSR) and client-side rendering (CSR).

**English** · [中文文档](./README.zh.md)

Built on the ideas of [markdown-it-mathjax3](https://github.com/tani/markdown-it-mathjax3), which this plugin was originally rewritten from. Many thanks to that project.

## Features

- 🚀 **Dual rendering modes** — pre-render on the server, or ship the formula source to MathJax in the browser
- 🎯 **Batch processing** — every formula on a page goes through one MathJax document, so the page gets a single stylesheet and macros carry across formulas
- 🎨 **Flexible output** — CHTML or SVG
- 📝 **Custom delimiters** — configure your own inline and block delimiters
- 🛡️ **Resilient** — a formula MathJax cannot parse degrades on its own instead of failing the whole render
- 🔧 **TypeScript** — ships type definitions for every option
- 📦 **Zero configuration** — sensible defaults out of the box

## Requirements

- Node.js 18 or newer
- markdown-it 12 or newer (peer dependency)

## Quick Start

### Installation

```bash
npm install markdown-it-mathjax3-pro
```

### Basic Usage

```javascript
import MarkdownIt from 'markdown-it';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

const md = MarkdownIt().use(MarkdownItMathJaX3PRO);

const markdown = `
Inline math: $E = mc^2$

Block math:
$$
\\frac{d}{dx}\\int_{a}^{x} f(t)dt = f(x)
$$
`;

const result = md.render(markdown);
console.log(result);
```

### Getting the stylesheet

In server-side mode MathJax also produces a stylesheet for the page. Pass an `env`
object to `render` and read it back afterwards:

```javascript
const env = {};
const html = md.render(markdown, env);

// Raw CSS, ready to drop inside a <style> element:
const css = env.mathjax_stylesheet;

// The same thing in head-entry form, for frameworks that consume it:
const headEntries = env.frontmatter.inject_content;
```

Without that stylesheet the assistive MathML stays visible and spacing is wrong,
so it is not optional.

## Configuration

### Server-Side Rendering (default)

```javascript
import MarkdownIt from 'markdown-it';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    tags: 'ams',
    packages: ['base', 'ams', 'newcommand', 'configmacros']
  },
  chtml: {
    fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
  }
});
```

Setting `svg` instead of `chtml` switches the output format:

```javascript
const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  svg: {
    fontCache: 'local',
    displayAlign: 'center'
  }
});
```

### Client-Side Rendering

```javascript
import MarkdownIt from 'markdown-it';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  user_side: true,
  tex: { tags: 'ams' },
  mathjax_options: {
    enableMenu: true
    // Other MathJax options
  }
});
```

In this mode the plugin still parses your formulas — that is what keeps Markdown
from reading `*`, `_` or the LaTeX `\\` line break inside a formula as markup —
but instead of rendering them it writes the source back out untouched and adds a
MathJax loader to `env.frontmatter.inject_content`. The browser does the rest.

Your `tex` block is forwarded to the browser configuration, so `inlineMath`,
`displayMath` and options such as `tags` behave the same on both sides. Values
have to survive `JSON.stringify`, so a function passed as a TeX option is dropped.

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `user_side` | boolean | `false` | Enable client-side rendering mode |
| `tex` | object | `{...}` | TeX input processor options |
| `tex.inlineMath` | array | `[['$', '$']]` | Inline math delimiters |
| `tex.displayMath` | array | `[['$$', '$$']]` | Block math delimiters |
| `chtml` | object | `{...}` | CHTML output options |
| `svg` | object | `undefined` | SVG output options (selects SVG over CHTML when set) |
| `mathjax_options` | object | `{ enableMenu: true }` | Browser-side MathJax `options` block; client-side mode only |

### Values written to `env`

| Key | Mode | Description |
|-----|------|-------------|
| `env.mathjax_stylesheet` | SSR | Raw CSS for the page, or `null` when the page has no math |
| `env.frontmatter.inject_content` | both | Head entries: a `style` entry in SSR, the config and loader `script` entries in CSR |

Entries are appended, so head content contributed by other plugins is preserved.

## Technical Implementation & Differences from markdown-it-mathjax3

1. **Dual mode support**
    - **SSR mode**: pre-renders math with MathJax on the server
    - **CSR mode**: protects the formula source and injects the MathJax loader

2. **Batch processing**
    - All formulas on a page share one MathJax document, so the page needs only one
      stylesheet and a macro defined in one formula is visible to the next

3. **Flexibility**
    - CHTML or SVG output
    - Configurable delimiters, applied consistently in both modes

4. **Stylesheet management**
    - CSS is extracted automatically and appended to `inject_content` for framework integration

5. **Failure isolation**
    - A formula MathJax cannot parse renders as a MathJax error box, or falls back to
      its escaped source. It never aborts the surrounding page.

### Architecture

```
Input Markdown
     ↓
Parse math tokens (inline and block)
     ↓
SSR: batch render with MathJax   │   CSR: write the source back out
     ↓                           │        ↓
Replace tokens with HTML         │   Inject the MathJax loader
     ↓
Append to inject_content
     ↓
Output HTML
```

## Examples

Runnable examples live in [example/](./example). Run both with:

```bash
npm run example
```

- [example/test.ts](./example/test.ts) — server-side rendering, writes `example/test.html`
- [example/test4csr.ts](./example/test4csr.ts) — client-side rendering, writes `example/test4csr.html`

### React + Vite (client-side rendering)

**index.html** — add the MathJax configuration and loader inside `<head>`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
    <!-- markdown-it-mathjax3-pro -->
    <script type="text/javascript">
      window.MathJax = {
        tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
        options: { enableMenu: true }
      };
    </script>
    <script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" id="MathJax-script"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Configure markdown-it**

```javascript
import MarkdownIt from 'markdown-it';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

const md = new MarkdownIt().use(MarkdownItMathJaX3PRO, {
  user_side: true,
  mathjax_options: {
    enableMenu: true
    // other MathJax options
  }
});
```

**Typeset after rendering**

Formulas have to be typeset once markdown-it has produced the HTML:

```javascript
const [htmlContent, setHtmlContent] = useState('');
// ...
useEffect(() => {
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise();
  }
}, [htmlContent]); // htmlContent is the rendered Markdown
```

### VitePress

**Server-side mode**

```ts
import { defineConfig, type HeadConfig } from 'vitepress';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

export default defineConfig({
  title: 'My Docs',
  description: 'Documentation site',
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.includes('mjx-')
      }
    }
  },
  markdown: {
    config: (md) => {
      md.use(MarkdownItMathJaX3PRO, {
        // add your own inline and block delimiters
        tex: {
          inlineMath: [['$', '$'], ['§', '§']],
          displayMath: [['$$', '$$'], ['§§', '§§']]
        },
        // CHTML output
        chtml: {
          fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
        }
      });
    },
    theme: {
      light: 'catppuccin-latte',
      dark: 'catppuccin-macchiato'
    }
  },
  // move the MathJax CSS into <head>
  transformPageData(pageData) {
    const head = (pageData.frontmatter.head ??= []);
    const inject_content = pageData.frontmatter.inject_content;
    if (inject_content && Array.isArray(inject_content)) {
      inject_content.forEach((item) => {
        const { type, contribution, content } = item;
        head.push([type, contribution || {}, content || ''] as HeadConfig);
      });
      delete pageData.frontmatter.inject_content;
    }
  }
});
```

**Client-side mode**

```ts
import { defineConfig, type HeadConfig } from 'vitepress';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

export default defineConfig({
  title: 'My Docs',
  description: 'Documentation site',
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.includes('mjx-')
      }
    }
  },
  markdown: {
    config: (md) => {
      md.use(MarkdownItMathJaX3PRO, {
        user_side: true
      });
    }
  },
  // move the MathJax config and loader into <head>
  transformPageData(pageData) {
    const head = (pageData.frontmatter.head ??= []);
    const inject_content = pageData.frontmatter.inject_content;
    if (inject_content && Array.isArray(inject_content)) {
      inject_content.forEach((item) => {
        const { type, contribution, content } = item;
        head.push([type, contribution || {}, content || ''] as HeadConfig);
      });
      delete pageData.frontmatter.inject_content;
    }
  }
});
```

## Development

```bash
npm install
npm run build     # compile to dist/
npm test          # build, then run the unit suite
npm run example   # build and run both examples
```

### Tests

The suite has two layers, both driven by the cases in `test/fixtures.js`:

- **Unit** — `test/index.test.js` checks the HTML the plugin returns. It needs no
  browser and runs on `npm test`. Every fixed bug has a regression test here.
- **End-to-end** — `test/e2e.test.js` serves the generated pages from a local HTTP
  server and loads them in headless Chromium, asserting against the live DOM: how
  many formulas the browser actually laid out, whether the MathJax stylesheet is in
  effect, and what text a reader ends up seeing. MathJax's browser bundle and fonts
  are served out of `mathjax-full`, so the suite never touches a CDN and runs offline.

The browser driver (`playwright-core`) is a devDependency, but the browser it
drives is a separate download that is not fetched on install, so `npm install`
stays small. Until you fetch it, the end-to-end suite skips itself.

```bash
npm run e2e:install   # download a matching chromium build (once)
npm run test:e2e      # end-to-end only
npm run test:all      # both layers
```

### Continuous integration

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs on every push to
`main` and on every pull request:

| Job | What it does |
|-----|--------------|
| `unit` | Builds and runs the unit suite on Node 18, 20, 22 and 24 |
| `e2e` | Installs Chromium and runs the end-to-end suite against it |
| `examples` | Runs both examples and checks the pages they write |
| `package` | Verifies the published tarball carries the build, the types, the licence and both READMEs |

The end-to-end job sets `E2E_REQUIRE_BROWSER=1`. Without it a missing browser
would skip the suite and still exit zero, hiding a gap in coverage behind a
green build; with it, a missing browser fails the job instead.

## License

[MIT](./LICENSE)

## Contributing

Contributions are welcome. Please feel free to open an issue or submit a pull request.

## Support

If you run into a problem, please open an issue on GitHub.
