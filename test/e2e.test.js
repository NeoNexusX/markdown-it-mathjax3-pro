'use strict';

const assert = require('node:assert/strict');
const { test, before, after, describe } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { cases, sharedCases, validCases, expectationsFor } = require('./fixtures.js');
const {
    buildServerSidePage,
    buildClientSidePage,
    startServer,
    renderInBrowser,
} = require('./e2e-helpers.js');

/**
 * End-to-end suite: every page here is loaded in a real browser and every
 * assertion is made against the resulting DOM. That is what separates it from
 * the unit suite, which only inspects the HTML string the plugin returns. A
 * formula counts as rendered only once the browser has laid it out.
 *
 * playwright-core is a devDependency, but the browser it drives is a separate
 * ~100MB download that it deliberately does not fetch on install. The suite
 * therefore skips itself when the browser is absent. Fetch it with:
 *     npm run e2e:install
 */
function loadBrowserDriver() {
    let chromium;
    try {
        ({ chromium } = require('playwright-core'));
    } catch {
        return { available: false, reason: 'playwright-core is not installed' };
    }
    if (!fs.existsSync(chromium.executablePath())) {
        return { available: false, reason: 'no chromium build is installed for this playwright-core version' };
    }
    return { available: true, chromium };
}

const driver = loadBrowserDriver();

// A skipped end-to-end suite still exits zero, which would let a regression
// through on a green CI build. Setting E2E_REQUIRE_BROWSER turns a missing
// browser into a failure instead, so CI cannot silently stop covering this.
if (!driver.available && process.env.E2E_REQUIRE_BROWSER) {
    throw new Error(
        `end-to-end tests are required in this environment, but ${driver.reason}. ` +
        'Run "npm run e2e:install" first.'
    );
}

const MODES = [
    { id: 'ssr', title: 'server-side rendering', build: buildServerSidePage },
    { id: 'csr', title: 'client-side rendering', build: buildClientSidePage },
];

describe('end-to-end rendering in a browser', { skip: driver.available ? false : driver.reason }, () => {
    let browser, page, server, pageDir;

    before(async () => {
        pageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdi-mathjax3-pro-e2e-'));

        // Write every fixture out in both modes up front, so a failing test
        // leaves an inspectable HTML file behind.
        for (const testCase of cases) {
            for (const mode of MODES) {
                fs.writeFileSync(
                    path.join(pageDir, `${testCase.name}.${mode.id}.html`),
                    mode.build(testCase.markdown).html
                );
            }
        }

        server = await startServer(pageDir);
        browser = await driver.chromium.launch();
        page = await browser.newPage();
    });

    after(async () => {
        await page?.close();
        await browser?.close();
        await server?.close();
        fs.rmSync(pageDir, { recursive: true, force: true });
    });

    const load = (name, mode) => renderInBrowser(page, `${server.baseUrl}/${name}.${mode}.html`);

    for (const mode of MODES) {
        describe(mode.title, () => {
            for (const testCase of cases) {
                test(`${testCase.name}: ${testCase.note}`, async () => {
                    const expected = expectationsFor(testCase, mode.id);
                    const actual = await load(testCase.name, mode.id);

                    assert.equal(actual.containerCount, expected.formulas,
                        `expected ${expected.formulas} typeset formulas, browser shows ${actual.containerCount}`);
                    assert.equal(actual.displayCount, expected.display,
                        `expected ${expected.display} display formulas, browser shows ${actual.displayCount}`);
                    assert.equal(actual.unlaidOut, 0,
                        `${actual.unlaidOut} formula(s) rendered with no box, so layout or fonts are missing`);
                    assert.equal(actual.unstyledDisplay, 0,
                        `${actual.unstyledDisplay} display formula(s) did not lay out as a centred block, so the MathJax stylesheet is not in effect`);
                    assert.equal(actual.emphasisCount, expected.emphasis,
                        `expected ${expected.emphasis} emphasis elements, browser shows ${actual.emphasisCount}`);
                    assert.equal(actual.errorCount > 0, expected.hasError,
                        expected.hasError
                            ? 'expected MathJax to report a problem, it reported none'
                            : `MathJax reported ${actual.errorCount} problem(s)`);

                    for (const snippet of expected.text) {
                        assert.ok(actual.text.includes(snippet),
                            `page text is missing ${JSON.stringify(snippet)}`);
                    }
                    for (const snippet of expected.absentText) {
                        assert.ok(!actual.text.includes(snippet),
                            `page text still shows ${JSON.stringify(snippet)}, so a formula was not typeset`);
                    }
                    if (expected.rows !== null) {
                        assert.equal(actual.tableRowCount, expected.rows,
                            `expected ${expected.rows} rows in the aligned environment, browser shows ${actual.tableRowCount}`);
                    }
                    if (expected.boldTags !== null) {
                        assert.equal(actual.boldTagCount, expected.boldTags,
                            'formula source was parsed as HTML markup');
                    }
                });
            }

            test('typesets every well-formed formula without an error box', async () => {
                for (const testCase of validCases) {
                    const actual = await load(testCase.name, mode.id);
                    assert.equal(actual.errorCount, 0, `${testCase.name} produced a MathJax error box`);
                }
            });
        });
    }

    test('both modes show the reader the same formulas', async () => {
        for (const testCase of sharedCases) {
            const ssr = await load(testCase.name, 'ssr');
            const csr = await load(testCase.name, 'csr');
            assert.equal(ssr.containerCount, csr.containerCount,
                `${testCase.name}: SSR shows ${ssr.containerCount} formulas, CSR shows ${csr.containerCount}`);
            assert.equal(ssr.displayCount, csr.displayCount,
                `${testCase.name}: display formula counts differ between modes`);
        }
    });

    test('server-side pages load no scripts at all', async () => {
        const requests = [];
        const record = request => requests.push(request.url());
        page.on('request', record);
        await load('multiple-formulas', 'ssr');
        page.off('request', record);

        assert.deepEqual(requests.filter(url => url.endsWith('.js')), [],
            'a pre-rendered page should not need JavaScript');
    });

    test('client-side pages load MathJax and typeset after it arrives', async () => {
        const requests = [];
        const record = request => requests.push(request.url());
        page.on('request', record);
        const actual = await load('multiple-formulas', 'csr');
        page.off('request', record);

        assert.ok(requests.some(url => url.endsWith('tex-mml-chtml.js')),
            'the MathJax loader was never requested');
        assert.equal(actual.containerCount, 6);
    });
});
