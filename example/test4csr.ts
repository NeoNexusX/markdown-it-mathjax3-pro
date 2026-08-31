/**
 * Client-side rendering example.
 *
 * In your own project this import would read:
 *     import MarkdownItMathJaX3PRO from 'markdown-it-mathjax3-pro';
 * The relative path is only used so the example runs against this repository.
 */
import MarkdownIt from 'markdown-it';
import { writeFileSync } from 'fs';
import { join } from 'path';
import MarkdownItMathJaX3PRO = require('../index');
import { sampleMarkdown } from './sample';

const md = MarkdownIt().use(MarkdownItMathJaX3PRO, {
    user_side: true,
    tex: { tags: 'ams' },
    mathjax_options: { enableMenu: true },
});

const env: Record<string, any> = {};
const renderedContent = md.render(sampleMarkdown, env);

// `inject_content` describes what belongs in <head>. Every entry has the same
// shape, so a single loop covers both the configuration script and the loader.
const injectContent: MarkdownItMathJaX3PRO.InjectEntry[] = env.frontmatter?.inject_content || [];

const injectHead = injectContent
    .map(({ type, contribution = {}, content = '' }) => {
        const attributes = Object.entries(contribution)
            .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${value}"`))
            .join('');
        return `    <${type}${attributes}>${content}</${type}>`;
    })
    .join('\n');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Direction Cosines - Client-Side Rendering</title>
${injectHead}
</head>
<body>
${renderedContent}
</body>
</html>`;

const outputPath = join(__dirname, '..', '..', 'test4csr.html');
writeFileSync(outputPath, htmlContent, 'utf8');

console.log(`HTML file generated successfully: ${outputPath}`);
