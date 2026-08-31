# markdown-it-mathjax3-pro

[![CI](https://github.com/NeoNexusX/markdown-it-mathjax3-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/NeoNexusX/markdown-it-mathjax3-pro/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/markdown-it-mathjax3-pro.svg)](https://www.npmjs.com/package/markdown-it-mathjax3-pro)
[![license](https://img.shields.io/npm/l/markdown-it-mathjax3-pro.svg)](./LICENSE)

一个支持 MathJax 3 的 markdown-it 插件,同时支持服务端渲染(SSR)和客户端渲染(CSR)两种模式。

[English](./README.md) · **中文**

本项目基于 [markdown-it-mathjax3](https://github.com/tani/markdown-it-mathjax3) 的思路重构而来,在此向该项目致谢。

## 特性

- 🚀 **双渲染模式** —— 既可以在服务端预渲染,也可以把公式原文交给浏览器里的 MathJax
- 🎯 **批量处理** —— 整页公式共用一个 MathJax 文档,因此全页只需一份样式表,宏定义也能在公式之间共享
- 🎨 **灵活输出** —— 支持 CHTML 与 SVG 两种输出格式
- 📝 **自定义分隔符** —— 行内与块级分隔符均可配置
- 🛡️ **容错** —— 单个无法解析的公式会就地降级,不会让整页渲染失败
- 🔧 **TypeScript** —— 所有配置项均带类型定义
- 📦 **零配置** —— 默认配置开箱即用

## 环境要求

- Node.js 18 及以上
- markdown-it 12 及以上(peer dependency)

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
行内公式:$E = mc^2$

块级公式:
$$
\\frac{d}{dx}\\int_{a}^{x} f(t)dt = f(x)
$$
`;

const result = md.render(markdown);
console.log(result);
```

### 获取样式表

服务端渲染模式下,MathJax 还会为当前页生成一份样式表。向 `render` 传入 `env`
对象,渲染完成后从中读取:

```javascript
const env = {};
const html = md.render(markdown, env);

// 纯 CSS,可直接放进 <style> 元素:
const css = env.mathjax_stylesheet;

// 同样的内容,以 head 条目的形式给框架使用:
const headEntries = env.frontmatter.inject_content;
```

缺少这份样式表时,辅助 MathML 会显示出来、间距也会错乱,所以它不是可选项。

## 配置

### 服务端渲染(默认)

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

把 `chtml` 换成 `svg` 即可切换输出格式:

```javascript
const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  svg: {
    fontCache: 'local',
    displayAlign: 'center'
  }
});
```

### 客户端渲染

```javascript
import MarkdownIt from 'markdown-it';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
  user_side: true,
  tex: { tags: 'ams' },
  mathjax_options: {
    enableMenu: true
    // 其他 MathJax 选项
  }
});
```

该模式下插件依然会解析公式 —— 正是这一步保证了 Markdown 不会把公式里的 `*`、`_`
或 LaTeX 换行符 `\\` 当成标记语法处理 —— 只是不做渲染,而是把公式原文原样写回,
并向 `env.frontmatter.inject_content` 追加一个 MathJax 加载器,剩下的交给浏览器。

你传入的 `tex` 会被转发到浏览器端配置,因此 `inlineMath`、`displayMath` 以及
`tags` 之类的选项在两侧行为一致。这些值需要能被 `JSON.stringify` 序列化,所以以
函数形式传入的 TeX 选项会被丢弃。

### 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `user_side` | boolean | `false` | 启用客户端渲染模式 |
| `tex` | object | `{...}` | TeX 输入处理器选项 |
| `tex.inlineMath` | array | `[['$', '$']]` | 行内公式分隔符 |
| `tex.displayMath` | array | `[['$$', '$$']]` | 块级公式分隔符 |
| `chtml` | object | `{...}` | CHTML 输出选项 |
| `svg` | object | `undefined` | SVG 输出选项(设置后即以 SVG 取代 CHTML) |
| `mathjax_options` | object | `{ enableMenu: true }` | 浏览器端 MathJax 的 `options` 配置块,仅客户端模式有效 |

### 写入 `env` 的内容

| 键 | 模式 | 说明 |
|-----|------|------|
| `env.mathjax_stylesheet` | SSR | 当前页的纯 CSS;页面中没有公式时为 `null` |
| `env.frontmatter.inject_content` | 两种模式 | head 条目:SSR 下是一条 `style`,CSR 下是配置与加载器两条 `script` |

条目是追加写入的,因此其他插件贡献的 head 内容不会被覆盖。

## 技术实现与 markdown-it-mathjax3 的区别

1. **双模式支持**
    - **SSR 模式**:在服务端用 MathJax 预渲染公式
    - **CSR 模式**:保护公式原文,并注入 MathJax 加载器

2. **批量处理**
    - 整页公式共用一个 MathJax 文档,因此全页只需一份样式表,某个公式里定义的宏
      对后续公式同样可见

3. **灵活性**
    - 支持 CHTML 与 SVG 输出
    - 分隔符可配置,且两种模式下行为一致

4. **样式表管理**
    - 自动提取 CSS 并追加到 `inject_content`,便于框架集成

5. **故障隔离**
    - 无法解析的公式会渲染成 MathJax 的错误框,或降级为转义后的原文,不会中断
      整页渲染

### 架构设计

```
输入 Markdown
     ↓
解析公式标记(行内与块级)
     ↓
SSR:用 MathJax 批量渲染    │    CSR:原样写回公式源码
     ↓                     │         ↓
用 HTML 替换标记            │    注入 MathJax 加载器
     ↓
追加到 inject_content
     ↓
输出 HTML
```

## 示例

可运行的示例位于 [example/](./example),执行以下命令即可运行:

```bash
npm run example
```

- [example/test.ts](./example/test.ts) —— 服务端渲染,输出 `example/test.html`
- [example/test4csr.ts](./example/test4csr.ts) —— 客户端渲染,输出 `example/test4csr.html`

### React + Vite 客户端渲染示例

**index.html** —— 在 `<head>` 中加入 MathJax 配置与加载器:

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

**为 markdown-it 添加插件配置**

```javascript
import MarkdownIt from 'markdown-it';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

const md = new MarkdownIt().use(MarkdownItMathJaX3PRO, {
  user_side: true,
  mathjax_options: {
    enableMenu: true
    // 其他 MathJax 选项
  }
});
```

**渲染完成后排版公式**

需要在 markdown-it 把 Markdown 转成 HTML 之后再排版公式:

```javascript
const [htmlContent, setHtmlContent] = useState('');
// ...
useEffect(() => {
  if (window.MathJax?.typesetPromise) {
    window.MathJax.typesetPromise();
  }
}, [htmlContent]); // htmlContent 是渲染完成的 Markdown
```

### VitePress 示例

**服务端渲染模式**

```ts
import { defineConfig, type HeadConfig } from 'vitepress';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

export default defineConfig({
  title: '我的文档',
  description: '文档站点',
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
        // 自定义行内与块级分隔符
        tex: {
          inlineMath: [['$', '$'], ['§', '§']],
          displayMath: [['$$', '$$'], ['§§', '§§']]
        },
        // 使用 CHTML 输出
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
  // 把 MathJax 的 CSS 注入 <head>
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

**客户端渲染模式**

```ts
import { defineConfig, type HeadConfig } from 'vitepress';
import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';

export default defineConfig({
  title: '我的文档',
  description: '文档站点',
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
  // 把 MathJax 的配置与加载器注入 <head>
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

## 开发

```bash
npm install
npm run build     # 编译到 dist/
npm test          # 先编译,再运行单元测试
npm run example   # 编译并运行两个示例
```

### 测试

测试分两层,共用 `test/fixtures.js` 里的同一组样例:

- **单元测试** —— `test/index.test.js` 检查插件返回的 HTML,不依赖浏览器,`npm test`
  即可运行。每个修复过的 bug 在这里都有对应的回归用例。
- **端到端测试** —— `test/e2e.test.js` 用本地 HTTP 服务提供生成的页面,再用无头
  Chromium 打开,所有断言都针对真实 DOM:浏览器实际排版出了几个公式、MathJax 的
  样式表是否真的生效、读者最终看到的文本是什么。MathJax 的浏览器包和字体都取自
  `mathjax-full`,因此整个流程不访问 CDN,可离线运行。

浏览器驱动 `playwright-core` 是 devDependency,但它驱动的浏览器是一份独立下载、
安装时并不会拉取,所以 `npm install` 依然很轻。在你下载浏览器之前,端到端测试会
自动跳过。

```bash
npm run e2e:install   # 下载配套的 chromium(一次即可)
npm run test:e2e      # 只跑端到端
npm run test:all      # 两层都跑
```

### 持续集成

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) 会在推送到 `main` 和
每个 Pull Request 上运行:

| Job | 作用 |
|-----|------|
| `unit` | 在 Node 18、20、22、24 上编译并运行单元测试 |
| `e2e` | 安装 Chromium 并运行端到端测试 |
| `examples` | 运行两个示例,并检查它们生成的页面 |
| `package` | 校验发布用的 tarball 包含构建产物、类型定义、许可证和两份 README |

端到端 job 设置了 `E2E_REQUIRE_BROWSER=1`。不设置的话,浏览器缺失时测试会自动跳过
并正常退出,等于用一个绿色的构建掩盖了覆盖率缺口;设置之后,浏览器缺失会直接让
job 失败。

## 许可证

[MIT](./LICENSE)

## 贡献

欢迎贡献!欢迎提 issue 或提交 Pull Request。

## 支持

如果遇到问题,请在 GitHub 上提交 issue。
