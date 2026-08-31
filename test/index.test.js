'use strict';

const assert = require('node:assert/strict');
const { test, describe } = require('node:test');
const MarkdownIt = require('markdown-it');
const { mathjax } = require('mathjax-full/js/mathjax.js');

const plugin = require('../dist/index.js');
const { cases, expectationsFor } = require('./fixtures.js');

const render = (options, src) => MarkdownIt().use(plugin, options).render(src);
const renderWithEnv = (options, src) => {
    const env = {};
    const html = MarkdownIt().use(plugin, options).render(src, env);
    return { html, env };
};

test('renders inline and block math without options', () => {
    const html = render(undefined, 'inline $E = mc^2$ here\n\n$$\n\\frac{a}{b}\n$$');
    assert.equal(html.match(/<mjx-container/g).length, 2);
});

test('accepts output options without a tex block', () => {
    // Regression: `options?.tex.inlineMath` threw when tex was absent.
    assert.doesNotThrow(() => render({ svg: { fontCache: 'local' } }, '$x$'));
    assert.doesNotThrow(() => render({ chtml: {} }, '$x$'));
    assert.doesNotThrow(() => render({}, '$x$'));
});

test('emits SVG output when the svg option is set', () => {
    assert.match(render({ svg: {} }, '$x$'), /jax="SVG"/);
    assert.match(render(undefined, '$x$'), /jax="CHTML"/);
});

test('keeps delimiters isolated between markdown-it instances', () => {
    // Regression: delimiters used to live in module-level variables, so the
    // instance created last silently reconfigured every earlier instance.
    const custom = MarkdownIt().use(plugin, {
        tex: { inlineMath: [['@', '@']], displayMath: [['@@', '@@']] },
    });
    const standard = MarkdownIt().use(plugin, {
        tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
    });

    assert.match(custom.render('@x@'), /<mjx-container/);
    assert.doesNotMatch(custom.render('$x$'), /<mjx-container/);
    assert.match(standard.render('$x$'), /<mjx-container/);
    assert.doesNotMatch(standard.render('@x@'), /<mjx-container/);
});

test('registers exactly one MathJax handler no matter how many renders run', () => {
    // Regression: RegisterHTMLHandler ran inside the core rule, stranding one
    // adaptor in MathJax's global registry per render.
    const md = MarkdownIt().use(plugin);
    md.render('$x$');
    const before = mathjax.handlers.items.length;
    for (let i = 0; i < 25; i++) {
        md.render(`$x^{${i}}$`);
    }
    MarkdownIt().use(plugin).render('$y$');
    assert.equal(mathjax.handlers.items.length, before);
});

test('degrades a broken formula instead of throwing', () => {
    // Regression: an unparseable formula used to abort the whole render.
    let html;
    assert.doesNotThrow(() => { html = render(undefined, 'before $\\frac{1}{$ after'); });
    assert.match(html, /before/);
    assert.match(html, /after/);
});

test('handles HTML special characters inside formulas', () => {
    // Regression: formula source was concatenated into an HTML string, so a
    // formula containing markup broke the renderer.
    assert.doesNotThrow(() => render(undefined, '$x <b> y$'));
    assert.match(render(undefined, '$a < b$'), /<mjx-container/);
});

test('exposes the stylesheet through env and frontmatter', () => {
    const { env } = renderWithEnv(undefined, '$x^2$');
    assert.ok(env.mathjax_stylesheet.length > 0);
    assert.doesNotMatch(env.mathjax_stylesheet, /<style/);
    const entry = env.frontmatter.inject_content.find(item => item.type === 'style');
    assert.equal(entry.contribution.type, 'text/css');
    assert.equal(entry.content, env.mathjax_stylesheet);
});

test('appends to inject_content instead of replacing it', () => {
    const env = { frontmatter: { inject_content: [{ type: 'script', content: 'from another plugin' }] } };
    MarkdownIt().use(plugin).render('$x$', env);
    assert.equal(env.frontmatter.inject_content.length, 2);
    assert.equal(env.frontmatter.inject_content[0].content, 'from another plugin');
});

test('does not stack duplicate entries when an env is reused', () => {
    const env = {};
    const md = MarkdownIt().use(plugin);
    md.render('$x$', env);
    md.render('$y$', env);
    assert.equal(env.frontmatter.inject_content.length, 1);
});

test('shares macros across formulas on the same page', () => {
    const html = render(undefined, '$$\\newcommand{\\foo}{42}\\foo$$\n\nlater $\\foo$');
    assert.doesNotMatch(html, /merror/);
});

test('leaves math inside code spans and fences alone', () => {
    assert.doesNotMatch(render(undefined, '`$x$`'), /<mjx-container/);
    assert.doesNotMatch(render(undefined, '```\n$x$\n```'), /<mjx-container/);
});

test('client-side mode protects formula source from Markdown syntax', () => {
    // Regression: client-side mode registered no parser rules, so markdown-it
    // rewrote '*' as emphasis and swallowed the LaTeX '\\' line break.
    const md = MarkdownIt().use(plugin, { user_side: true });
    assert.equal(md.render('$x*y*z$').trim(), '<p>$x*y*z$</p>');
    assert.doesNotMatch(md.render('$x*y*z$'), /<em>/);
    assert.match(md.render('$$\na &= b \\\\\nc &= d\n$$'), /\\\\/);
    assert.equal(md.render('$a \\_b$').trim(), '<p>$a \\_b$</p>');
});

test('client-side mode escapes HTML in formula source', () => {
    const md = MarkdownIt().use(plugin, { user_side: true });
    const html = md.render('$x <b> y$');
    assert.doesNotMatch(html, /<b>/);
    assert.match(html, /&lt;b&gt;/);
});

test('client-side mode keeps user tex options and delimiters', () => {
    // Regression: the config was built with JSON.stringify's replacer argument,
    // which silently discarded every user supplied tex option.
    const { env } = renderWithEnv(
        { user_side: true, tex: { tags: 'ams', inlineMath: [['\\(', '\\)']] } },
        'x'
    );
    const config = env.frontmatter.inject_content.find(item => item.content).content;
    assert.match(config, /"tags":"ams"/);
    assert.match(config, /\\\\\(/);
});

test('client-side mode cannot be broken out of with a script tag', () => {
    const { env } = renderWithEnv(
        { user_side: true, mathjax_options: { note: '</script><script>alert(1)</script>' } },
        'x'
    );
    const config = env.frontmatter.inject_content.find(item => item.content).content;
    assert.doesNotMatch(config, /<\/script>/i);
    assert.match(config, /\\u003c/);
});

test('client-side mode injects the MathJax loader', () => {
    const { env } = renderWithEnv({ user_side: true }, '$x$');
    const cdn = env.frontmatter.inject_content.find(item => item.contribution && item.contribution.src);
    assert.equal(cdn.contribution.id, 'MathJax-script');
    assert.equal(cdn.contribution.async, true);
});

test('client-side mode honours custom delimiters', () => {
    const md = MarkdownIt().use(plugin, {
        user_side: true,
        tex: { inlineMath: [['@', '@']], displayMath: [['@@', '@@']] },
    });
    assert.equal(md.render('@x*y*z@').trim(), '<p>@x*y*z@</p>');
});

test('ignores malformed delimiter configuration', () => {
    assert.doesNotThrow(() => render({ tex: { inlineMath: 'nonsense' } }, '$x$'));
    assert.match(render({ tex: { inlineMath: [] } }, '$x$'), /<mjx-container/);
    assert.match(render({ tex: { inlineMath: [['$'], null] } }, '$x$'), /<mjx-container/);
});

test('tries the longest matching delimiter first', () => {
    const md = MarkdownIt().use(plugin, {
        tex: { inlineMath: [['$', '$'], ['$$$', '$$$']] },
    });
    assert.match(md.render('$$$x$$$'), /<mjx-container/);
});

test('exposes the plugin under both default and named shapes', () => {
    assert.equal(typeof plugin, 'function');
    assert.equal(plugin.default, plugin);
    assert.equal(plugin.displayName, 'MarkdownItMathJaX3PRO');
});

// The same cases the end-to-end suite loads in a browser, checked here at the
// HTML level so a regression shows up without needing a browser installed.
describe('shared test cases', () => {
    for (const testCase of cases) {
        const expected = expectationsFor(testCase, 'ssr');

        test(`${testCase.name} (server-side): ${testCase.note}`, () => {
            const env = {};
            const html = MarkdownIt().use(plugin).render(testCase.markdown, env);

            assert.equal((html.match(/<mjx-container/g) || []).length, expected.formulas,
                'wrong number of rendered formulas');
            assert.equal((html.match(/<mjx-container[^>]*display="true"/g) || []).length, expected.display,
                'wrong number of display formulas');
            assert.equal(!!env.mathjax_stylesheet, expected.formulas > 0,
                'a page with math needs a stylesheet, a page without must not produce one');
            assert.doesNotMatch(html, /\$\$/, 'a block delimiter survived into the output');
        });

        test(`${testCase.name} (client-side): ${testCase.note}`, () => {
            const html = MarkdownIt().use(plugin, { user_side: true }).render(testCase.markdown);
            const csr = expectationsFor(testCase, 'csr');

            // Client-side mode renders nothing itself; it must hand the browser
            // the formula source with no Markdown applied to it.
            assert.doesNotMatch(html, /<mjx-container/, 'client-side mode must not pre-render');
            assert.equal((html.match(/<em>|<strong>/g) || []).length, csr.emphasis,
                'Markdown emphasis was applied inside a formula');
            assert.doesNotMatch(html, /<b>/, 'formula source was parsed as HTML markup');
        });
    }

    test('client-side mode preserves the LaTeX line break verbatim', () => {
        const alignedCase = cases.find(c => c.name === 'aligned-line-break');
        const html = MarkdownIt().use(plugin, { user_side: true }).render(alignedCase.markdown);
        assert.match(html, /a &amp;= b \+ c \\\\/, 'the LaTeX row separator was altered');
    });

    test('client-side mode preserves an escaped underscore verbatim', () => {
        const html = MarkdownIt().use(plugin, { user_side: true }).render('$x \\_ y$');
        assert.match(html, /\$x \\_ y\$/, 'the backslash of an escaped underscore was eaten');
    });
});
