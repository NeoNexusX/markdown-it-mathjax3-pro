'use strict';

/**
 * Test cases shared by the unit and end-to-end suites.
 *
 * A case names the Markdown that goes in and what has to be true of the page
 * once a browser has rendered it. `expect` applies to both rendering modes;
 * `ssr` and `csr` override individual keys when the two modes legitimately
 * differ.
 *
 *   formulas    typeset formulas the page should contain
 *   display     how many of those are block (display) formulas
 *   emphasis    <em>/<strong> elements the page should contain
 *   rows        rows in a multi-line environment, when the case has one
 *   hasError    whether MathJax is expected to report a problem
 *   text        substrings that must appear in the page's visible text
 *   absentText  substrings that must NOT appear; a leftover '$' or a raw
 *               control sequence means a formula was never typeset
 */
const cases = [
    {
        name: 'basic',
        note: 'The README quick-start example, inline and block together.',
        markdown: [
            'Einstein wrote $E = mc^2$ in 1905.',
            '',
            'The fundamental theorem of calculus:',
            '',
            '$$',
            '\\frac{d}{dx}\\int_{a}^{x} f(t)dt = f(x)',
            '$$',
        ].join('\n'),
        expect: {
            formulas: 2,
            display: 1,
            text: ['Einstein wrote', 'in 1905.'],
            absentText: ['$', 'mc^2', '\\frac'],
        },
    },
    {
        name: 'asterisks',
        note: 'Paired asterisks inside a formula used to be read as Markdown emphasis.',
        markdown: 'Independence: $P(A \\cap B) = P(A)*P(B)$ for independent events.',
        expect: {
            formulas: 1,
            display: 0,
            text: ['Independence:', 'for independent events.'],
            absentText: ['$', 'P(A)*P(B)'],
        },
    },
    {
        name: 'aligned-line-break',
        note: "Markdown used to swallow one of the two backslashes in the LaTeX '\\\\' line break.",
        markdown: [
            '$$',
            '\\begin{aligned}',
            'a &= b + c \\\\',
            'd &= e + f',
            '\\end{aligned}',
            '$$',
        ].join('\n'),
        expect: {
            formulas: 1,
            display: 1,
            // Two rows only appear if the row separator survived Markdown.
            rows: 2,
            text: [],
            absentText: ['$', 'begin{aligned}'],
        },
    },
    {
        name: 'underscores-and-escapes',
        note: 'Underscores must reach MathJax as TeX, not as Markdown emphasis.',
        markdown: 'Vectors $a_i$ and $b_j$, an escaped underscore $x \\_ y$, and $a _b c_ d$.',
        expect: {
            formulas: 4,
            display: 0,
            // Without the plugin, '_b c_' becomes <em> and the backslash of
            // '\_' is eaten. A visible '_' proves the escape survived.
            text: ['Vectors', 'an escaped underscore', '_'],
            absentText: ['$', '\\_', 'a_i'],
        },
    },
    {
        name: 'html-special-characters',
        note: 'A formula containing angle brackets used to crash the renderer.',
        markdown: 'Compare $a < b$ with $c > d$, and note $x <b> y$ is not markup.',
        expect: {
            formulas: 3,
            display: 0,
            // The literal '<b>' must never become a real element.
            boldTags: 0,
            text: ['Compare', 'is not markup'],
            absentText: ['$'],
        },
    },
    {
        name: 'multiple-formulas',
        note: 'Exercises the batch path: several formulas share one MathJax document.',
        markdown: [
            'Start $\\alpha$ then $\\beta$ then $\\gamma$.',
            '',
            '$$',
            '\\sum_{i=1}^{n} x_i',
            '$$',
            '',
            'And $\\delta$ to finish.',
            '',
            '$$',
            '\\int_0^\\infty e^{-x}\\,dx = 1',
            '$$',
        ].join('\n'),
        expect: {
            formulas: 6,
            display: 2,
            text: ['Start', 'And', 'to finish.'],
            absentText: ['$', '\\alpha', '\\sum'],
        },
    },
    {
        name: 'math-in-structures',
        note: 'Math nested inside lists, blockquotes and tables lives in child tokens.',
        markdown: [
            '- A list item with $x^2$',
            '- Another with $y^3$',
            '',
            '> A blockquote with $z^4$',
            '',
            '| Column | Value |',
            '| ------ | ----- |',
            '| first  | $a+b$ |',
        ].join('\n'),
        expect: {
            formulas: 4,
            display: 0,
            text: ['A list item with', 'A blockquote with', 'Column'],
            absentText: ['$', 'x^2'],
        },
    },
    {
        name: 'no-math',
        note: 'A page without math renders normally and produces no stylesheet.',
        markdown: 'Just prose, a *word* in italics and a `code span`. Nothing to typeset.',
        expect: {
            formulas: 0,
            display: 0,
            emphasis: 1,
            text: ['Just prose', 'word', 'code span'],
            absentText: [],
        },
    },
    {
        name: 'math-must-not-leak-into-code',
        note: 'Delimiters inside code must survive as text, not become math.',
        markdown: [
            'A code span `$x$` stays literal.',
            '',
            '```',
            '$y$',
            '```',
        ].join('\n'),
        expect: {
            formulas: 0,
            display: 0,
            text: ['stays literal', '$x$', '$y$'],
            absentText: [],
        },
    },
    {
        name: 'broken-formula',
        note: 'An unparseable formula degrades without taking the page down.',
        markdown: 'Before $\\frac{1}{$ after.',
        expect: {
            display: 0,
            text: ['Before', 'after.'],
            absentText: [],
        },
        // The two modes parse TeX in different places, so they degrade
        // differently. Server-side, MathJax compiles the formula and returns an
        // error box. In the browser MathJax refuses to match the delimiters at
        // all, because the braces are unbalanced, and leaves the text alone.
        ssr: { formulas: 1, hasError: true },
        csr: { formulas: 0, hasError: false, text: ['Before', '$\\frac{1}{$', 'after.'] },
    },
];

const DEFAULTS = {
    formulas: 0,
    display: 0,
    emphasis: 0,
    boldTags: null,
    rows: null,
    hasError: false,
    text: [],
    absentText: [],
};

/** Resolve one case's expectations for a given mode ('ssr' or 'csr'). */
function expectationsFor(testCase, mode) {
    return Object.assign({}, DEFAULTS, testCase.expect, testCase[mode]);
}

/** Cases whose behaviour is identical in both modes. */
const sharedCases = cases.filter(testCase => !testCase.ssr && !testCase.csr);

/** Cases MathJax should typeset without reporting an error. */
const validCases = cases.filter(testCase => !expectationsFor(testCase, 'ssr').hasError);

module.exports = { cases, sharedCases, validCases, expectationsFor };
