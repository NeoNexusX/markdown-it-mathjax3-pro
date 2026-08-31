'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('markdown-it');

const plugin = require('../dist/index.js');

/**
 * MathJax's browser bundle and its web fonts ship inside mathjax-full, so the
 * end-to-end pages can load them from a local server. Nothing here touches a
 * CDN, which keeps the suite offline and deterministic.
 */
const MATHJAX_ES5_DIR = path.dirname(require.resolve('mathjax-full/es5/tex-mml-chtml.js'));
const FONT_URL = '/mathjax/output/chtml/fonts/woff-v2';
const LOADER_URL = '/mathjax/tex-mml-chtml.js';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const PAGE_STYLE = `
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }`;

/** Render one fixture the way the server-side example does. */
function buildServerSidePage(markdown) {
    const md = MarkdownIt().use(plugin, { chtml: { fontURL: FONT_URL } });
    const env = {};
    const body = md.render(markdown, env);
    const stylesheet = env.mathjax_stylesheet || '';

    return {
        env,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SSR</title>
<style>${PAGE_STYLE}
${stylesheet}
</style>
</head>
<body>
${body}
</body>
</html>`,
    };
}

/** Render one fixture the way the client-side example does. */
function buildClientSidePage(markdown) {
    const md = MarkdownIt().use(plugin, { user_side: true });
    const env = {};
    const body = md.render(markdown, env);

    // Reuse the plugin's own inject_content entries rather than hand-writing the
    // <head>, so the test exercises what a real integration would consume. The
    // CDN loader is repointed at the locally served bundle.
    const head = (env.frontmatter?.inject_content || [])
        .map(({ type, contribution = {}, content = '' }) => {
            const attributes = Object.entries(contribution)
                .map(([key, value]) => {
                    const actual = key === 'src' ? LOADER_URL : value;
                    return actual === true ? ` ${key}` : ` ${key}="${actual}"`;
                })
                .join('');
            return `<${type}${attributes}>${content}</${type}>`;
        })
        .join('\n');

    return {
        env,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CSR</title>
<style>${PAGE_STYLE}
</style>
${head}
</head>
<body>
${body}
</body>
</html>`,
    };
}

/**
 * Serve the generated pages alongside MathJax's browser bundle and fonts.
 * Returns the base URL and a close function.
 */
async function startServer(pageDir) {
    const server = http.createServer((req, res) => {
        const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const isMathJax = requested.startsWith('/mathjax/');
        const root = isMathJax ? MATHJAX_ES5_DIR : pageDir;
        const relative = isMathJax ? requested.slice('/mathjax/'.length) : requested.slice(1);
        const filePath = path.join(root, relative);

        // Refuse anything that escapes the directory being served.
        if (!filePath.startsWith(root + path.sep)) {
            res.writeHead(403).end('Forbidden');
            return;
        }

        fs.readFile(filePath, (error, data) => {
            if (error) {
                res.writeHead(404).end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
            res.end(data);
        });
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise(resolve => server.close(resolve)),
    };
}

/**
 * Read back what the browser actually ended up showing. Everything here is
 * measured from the live DOM, not from the HTML string the plugin produced.
 */
function readPage() {
    const containers = Array.from(document.querySelectorAll('mjx-container'));
    return {
        containerCount: containers.length,
        displayCount: containers.filter(node => node.getAttribute('display') === 'true').length,
        // A formula that failed to lay out has no box, which is how a missing
        // stylesheet or a font that never loaded shows up.
        unlaidOut: containers.filter(node => {
            const box = node.getBoundingClientRect();
            return box.width < 1 || box.height < 1;
        }).length,
        errorCount: document.querySelectorAll('mjx-merror, [data-mjx-error]').length,
        // A display formula only computes to a centred block once MathJax's
        // stylesheet is actually in effect. Without it these stay inline, which
        // is how a missing or mis-extracted stylesheet shows up.
        unstyledDisplay: containers.filter(node => {
            if (node.getAttribute('display') !== 'true') return false;
            const style = getComputedStyle(node);
            return style.display !== 'block' || style.textAlign !== 'center';
        }).length,
        tableRowCount: document.querySelectorAll('mjx-mtr').length,
        // innerText is what a reader sees; assistive MathML is hidden by the
        // stylesheet and correctly does not appear here.
        text: document.body.innerText,
        emphasisCount: document.querySelectorAll('em, strong').length,
        boldTagCount: document.querySelectorAll('b').length,
    };
}

/** Load one page in the browser and wait until MathJax has settled. */
async function renderInBrowser(page, url) {
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(async () => {
        // Present only in client-side mode; resolves once typesetting is done.
        if (window.MathJax?.startup?.promise) {
            await window.MathJax.startup.promise;
        }
        await document.fonts.ready;
    });
    return page.evaluate(readPage);
}

module.exports = {
    buildServerSidePage,
    buildClientSidePage,
    startServer,
    renderInBrowser,
    FONT_URL,
    LOADER_URL,
};
