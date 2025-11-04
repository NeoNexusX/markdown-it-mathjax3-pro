# markdown-it-mathjax3-pro

A powerful markdown-it plugin for MathJax 3 with enhanced features supporting both Server-Side Rendering (SSR) and Client-Side Rendering (CSR) modes.
- [中文文档](./README.zh.md)

Thanks for project :[markdown-it-mathjax3](https://github.com/tani/markdown-it-mathjax3 ) 

## Features

- 🚀 **Dual Rendering Modes**: Support both SSR and CSR
- 🎯 **Enhanced Performance**: Optimized batch processing for multiple math expressions
- 🎨 **Flexible Output**: Support both SVG and CHTML output formats
- 📝 **Custom Delimiters**: Configurable math delimiters
- 🔧 **TypeScript Support**: Full TypeScript support with type definitions
- 📦 **Zero Configuration**: Works out of the box with sensible defaults

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

## Configuration

The plugin accepts various configuration options:

### Server-Side Rendering (Default)

```javascript
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro'

const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
    tags: 'ams',
    packages: ['base', 'ams', 'newcommand', 'configmacros']
  },
  chtml: {
    fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
  },
  // Use SVG output instead of CHTML
  svg: {
    fontCache: 'local',
    displayAlign: 'center'
  }
});
```

### Client-Side Rendering

```javascript
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro'

const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  user_side: true,
  mathjax_options: {
    enableMenu: true,
    // Other MathJax options
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `user_side` | boolean | false | Enable client-side rendering mode |
| `tex` | object | {...} | TeX input processor options |
| `tex.inlineMath` | array | [['$', '$']] | Inline math delimiters |
| `tex.displayMath` | array | [['$$', '$$']] | Block math delimiters |
| `chtml` | object | {...} | CHTML output options |
| `svg` | object | undefined | SVG output options (uses SVG instead of CHTML when provided) |
| `mathjax_options` | object | {} | Client-side MathJax configuration |

## Technical Implementation & Differences from markdown-it-mathjax3

### Key Differences from markdown-it-mathjax3

1. **Dual Mode Support**
    - **SSR Mode**: Uses MathJax-full to pre-render math expressions on the server
    - **CSR Mode**: Injects MathJax scripts for client-side rendering

2. **Batch Processing Mechanism**
    - Processes all math expressions in a single MathJax document
    - Significantly improves performance for documents with multiple formulas

3. **Enhanced Flexibility**
    - Support for both SVG and CHTML output formats
    - Configurable math delimiters
    - Better error handling and validation

4. **Stylesheet Management**
    - Automatic CSS style extraction and injection
    - Support for frontmatter injection for framework integration

### Architecture Design

```
Input Markdown
     ↓
Parse math tokens (inline and block)
     ↓
Batch process with MathJax
     ↓
Replace tokens with rendered HTML
     ↓
Inject stylesheets
     ↓
Output HTML
```

## Examples

### Complete Custom Configuration Example

See test.ts for details

### Client-Side Rendering Example

See test4csr.ts for details

### React + Vite Client-Side Rendering Example

**index.html**

Add the following code between the `<head>` elements:

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
                                    startup: { 
                                        ready: () => {
                                            MathJax.startup.defaultReady();
                                            console.log('MathJax loaded');
                                        }
                                    },
                                    tex: {"inlineMath":[["$","$"]],"displayMath":[["$$","$$"]]},
                                    options: {"enableMenu":true}
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

**Add markdown-it-mathjax3-pro configuration to markdown-it**

```javascript
import MarkdownIt from "markdown-it";
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

new MarkdownIt()
 .use(MarkdownItMathJaX3PRO, {
          user_side: true,
          mathjax_options: {
            enableMenu: true,
            // other MathJax options
          }
        })
```

**Render math formulas**

You need to render math formulas after markdown-it has converted the markdown file into HTML:

```javascript
  // Render math formulas when htmlContent changes for the first time
  const [htmlContent, setHtmlContent] = useState("");
  //...
  useEffect(() => {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [htmlContent]); // htmlContent is the rendered Markdown
```

### Vitepress example

ServerSide mode:

```ts
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro'

export default defineConfig({
  title: "neonexus",
  description: "docs for neonexus",
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.includes('mjx-')
      }
    }
  },
  markdown: {
    config: (md) => {
      md.use(mathjax3, {
        // add new inlineMathSeparator && displayMathSeparator
        tex: {
          inlineMath: [['$', '$'], ['§', '§']],
          displayMath: [['$$', '$$'], ['§§', '§§']],
        },
        //enable chtml mode 
        chtml: {
          fontURL: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2'
        }
      })
    },
    theme: {
      light: "catppuccin-latte",
      dark: "catppuccin-macchiato",
    },
  },
  //inject ccs to head for mathjax
  transformPageData(pageData) {
    const head = (pageData.frontmatter.head ??= []);
    const inject_content = pageData.frontmatter.inject_content;
    if (inject_content && Array.isArray(inject_content)) {
      inject_content.forEach(item => {
        const { type, contribution, content } = item;
        const headEntry = [type, contribution || {}, content || ''].filter(Boolean);
        head.push(headEntry as HeadConfig);
      });

      delete pageData.frontmatter.inject_content;
    }
  },
})
```

UserSide mode:

```ts
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro'

export default defineConfig({
  title: "your name",
  description: "docs for wahtever",
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.includes('mjx-')
      }
    }
  },
  markdown: {
    config: (md) => {
      md.use(mathjax3, {
        user_side: true,
      })
    },
  },
  //inject for mathjax script
  transformPageData(pageData) {
    const head = (pageData.frontmatter.head ??= []);
    const inject_content = pageData.frontmatter.inject_content;
    if (inject_content && Array.isArray(inject_content)) {
      inject_content.forEach(item => {
        const { type, contribution, content } = item;
        const headEntry = [type, contribution || {}, content || ''].filter(Boolean);
        head.push(headEntry as HeadConfig);
      });
      delete pageData.frontmatter.inject_content;
    }
  },
})
```



## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you have any questions or issues, please create an issue on GitHub.
