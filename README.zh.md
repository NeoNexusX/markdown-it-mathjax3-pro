# markdown-it-mathjax3-pro

一个功能强大的 markdown-it 插件，支持 MathJax 3，具有增强功能，支持服务器端渲染 (SSR) 和客户端渲染 (CSR) 模式。

谢谢项目作为指导，我重构了整个项目，在此仍表示感谢：[markdown-it-mathjax3](https://github.com/tani/markdown-it-mathjax3 ) 

## 特性

- 🚀 **双重渲染模式**：支持 SSR 和 CSR 两种模式
- 🎯 **性能增强**：为多个数学表达式优化的批处理
- 🎨 **灵活输出**：支持 SVG 和 CHTML 输出格式
- 📝 **自定义分隔符**：可配置的数学分隔符
- 🔧 **TypeScript 支持**：完整的 TypeScript 支持和类型定义
- 📦 **零配置**：开箱即用，具有合理的默认设置

## 快速开始

### 安装

```bash
npm install markdown-it-mathjax3-pro
```

### 基本用法

```javascript
import MarkdownIt from 'markdown-it';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

const md = MarkdownIt().use(MarkdownItMathJaX3PRO);

const markdown = `
行内数学公式：$E = mc^2$

块级数学公式：
$$
\\frac{d}{dx}\\int_{a}^{x} f(t)dt = f(x)
$$
`;

const result = md.render(markdown);
console.log(result);
```

## 项目配置

插件接受各种配置选项：

### 服务器端渲染（默认）

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
  // 使用 SVG 输出代替 CHTML
  svg: {
    fontCache: 'local',
    displayAlign: 'center'
  }
});
```

### 客户端渲染

```javascript
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro'

const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  user_side: true,
  mathjax_options: {
    enableMenu: true,
    // 其他 MathJax 选项
  }
});
```

### 配置选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `user_side` | boolean | false | 启用客户端渲染模式 |
| `tex` | object | {...} | TeX 输入处理器选项 |
| `tex.inlineMath` | array | [['$', '$']] | 行内数学分隔符 |
| `tex.displayMath` | array | [['$$', '$$']] | 块级数学分隔符 |
| `chtml` | object | {...} | CHTML 输出选项 |
| `svg` | object | undefined | SVG 输出选项（提供时使用 SVG 代替 CHTML） |
| `mathjax_options` | object | {} | 客户端 MathJax 配置 |

## 技术实现原理与 markdown-it-mathjax3 的区别和优势

### 与 markdown-it-mathjax3 的主要区别

1. **双模式支持**
   - **SSR 模式**：使用 MathJax-full 在服务器上预渲染数学表达式
   - **CSR 模式**：注入 MathJax 脚本进行客户端渲染

2. **批处理机制**
   - 在单个 MathJax 文档中处理所有数学表达式
   - 显著提高包含多个公式的文档的性能

3. **增强的灵活性**
   - 支持 SVG 和 CHTML 输出格式
   - 可配置的数学分隔符
   - 更好的错误处理和验证

4. **样式表管理**
   - 自动提取和注入 CSS 样式
   - 支持框架集成的 frontmatter 注入

### 架构设计

```
输入 Markdown
     ↓
解析数学标记（行内和块级）
     ↓
使用 MathJax 批处理
     ↓
用渲染的 HTML 替换标记
     ↓
注入样式表
     ↓
输出 HTML
```

## 示例

### 完整的自定义配置示例

See test.ts for details

### 客户端渲染示例

详见test4csr.ts

### React + Vite的客户端渲染示例

**index.html**

`<head>`元素之间添加如下代码:

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

**markdown-it添加markdown-it-mathjax3-pro配置**

```javascript
import MarkdownIt from "markdown-it";
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

new MarkdownIt()
 .use(MarkdownItMathJaX3PRO, {
          user_side: true,
          mathjax_options: {
            enableMenu: true,
            // 其他 MathJax 选项
          }
        })
```



**渲染数学公式**

需要在markdown-it渲染md文件为html之后渲染数学公式

```javascript
  // 渲染数学公式，当htmlContent第一次变化
  const [htmlContent, setHtmlContent] = useState("");
  //...
  useEffect(() => {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [htmlContent]); // htmlContent 是你渲染完成后的 Markdown
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



## 许可证

MIT

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 支持

如果您有任何问题或疑问，请在 GitHub 上提出 issue。
