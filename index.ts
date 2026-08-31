import type MarkdownIt from "markdown-it";
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { CHTML } from "mathjax-full/js/output/chtml.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";
import { AssistiveMmlHandler } from "mathjax-full/js/a11y/assistive-mml.js";

type StateInline = MarkdownIt.StateInline;
type StateBlock = MarkdownIt.StateBlock;
type StateCore = MarkdownIt.StateCore;
type Token = MarkdownIt.Token;

const DEFAULT_INLINE_MATH: plugin.Delimiter[] = [["$", "$"]];
const DEFAULT_DISPLAY_MATH: plugin.Delimiter[] = [["$$", "$$"]];
const DEFAULT_CHTML_FONT_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2";
const DEFAULT_MATHJAX_CDN = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";

/**
 * MathJax keeps a process-wide registry of document handlers. Registering one
 * per render would strand an adaptor on every call, so register exactly once
 * and share the adaptor across every plugin instance in the process.
 */
let sharedAdaptor: ReturnType<typeof liteAdaptor> | null = null;

function getAdaptor(): ReturnType<typeof liteAdaptor> {
    if (!sharedAdaptor) {
        sharedAdaptor = liteAdaptor();
        AssistiveMmlHandler(RegisterHTMLHandler(sharedAdaptor));
    }
    return sharedAdaptor;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function escapeAttribute(str: string): string {
    return escapeHtml(str).replace(/"/g, "&quot;");
}

/**
 * Serialise a value for embedding inside an inline <script>. Escaping the
 * characters that could terminate the element early stops a value such as
 * "</script>" from breaking out of the script block.
 */
function toScriptJson(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029");
}

/**
 * Accept a user supplied delimiter list, discarding malformed entries and
 * falling back to the default when nothing usable is left. Pairs are sorted by
 * descending opening length so a longer delimiter is always tried before a
 * shorter one it starts with.
 */
function normalizeDelimiters(value: unknown, fallback: plugin.Delimiter[]): plugin.Delimiter[] {
    if (!Array.isArray(value)) {
        return fallback.slice();
    }
    const pairs = value.filter(
        (pair): pair is plugin.Delimiter =>
            Array.isArray(pair) &&
            typeof pair[0] === "string" && pair[0].length > 0 &&
            typeof pair[1] === "string" && pair[1].length > 0
    );
    if (pairs.length === 0) {
        return fallback.slice();
    }
    return pairs.slice().sort((a, b) => b[0].length - a[0].length);
}

function isValidDelim(state: StateInline, pos: number, delimiter = "$") {
    const max = state.posMax;
    let can_open = true, can_close = true;
    const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
    const nextChar = pos + delimiter.length <= max ? state.src.charCodeAt(pos + delimiter.length) : -1;

    // Check non-whitespace conditions for opening and closing, and
    // check that closing delimiter isn't followed by a number
    if (prevChar === 0x20 /* " " */ ||
        prevChar === 0x09 /* \t */ ||
        (nextChar >= 0x30 /* "0" */ && nextChar <= 0x39) /* "9" */) {
        can_close = false;
    }
    if (nextChar === 0x20 /* " " */ || nextChar === 0x09 /* \t */) {
        can_open = false;
    }

    return { can_open, can_close };
}

/**
 * Build the inline rule for one plugin instance. The delimiter list is captured
 * in the closure rather than held in a module variable, so two markdown-it
 * instances configured with different delimiters cannot overwrite each other.
 */
function createInlineRule(inlineMath: plugin.Delimiter[]) {
    return function math_inline(state: StateInline, silent: boolean): boolean {
        let matched: plugin.Delimiter | null = null;
        for (const pair of inlineMath) {
            if (state.src.startsWith(pair[0], state.pos)) {
                matched = pair;
                break;
            }
        }
        if (!matched) {
            return false;
        }

        const [openDelim, closeDelim] = matched;

        if (!isValidDelim(state, state.pos, openDelim).can_open) {
            if (!silent) {
                state.pending += openDelim;
            }
            state.pos += openDelim.length;
            return true;
        }

        // Skip past any escaped copies of the closing delimiter; `match` ends up
        // on the first one that is genuinely closing the formula.
        const start = state.pos + openDelim.length;
        let match = start;
        while ((match = state.src.indexOf(closeDelim, match)) !== -1) {
            let pos = match - 1;
            while (state.src[pos] === "\\") {
                pos -= 1;
            }
            // Even number of escapes, potential closing delimiter found
            if ((match - pos) % 2 === 1) {
                break;
            }
            match += 1;
        }

        // No closing delimiter found. Consume opening delimiter and continue.
        if (match === -1) {
            if (!silent) {
                state.pending += openDelim;
            }
            state.pos = start;
            return true;
        }

        // Empty content, ie: openDelim + closeDelim. Do not parse.
        if (match - start === 0) {
            if (!silent) {
                state.pending += openDelim + closeDelim;
            }
            state.pos = start + closeDelim.length;
            return true;
        }

        if (!isValidDelim(state, match, closeDelim).can_close) {
            if (!silent) {
                state.pending += openDelim;
            }
            state.pos = start;
            return true;
        }

        if (!silent) {
            const token = state.push("math_inline", "math", 0);
            token.markup = openDelim;
            token.info = closeDelim;
            token.content = state.src.slice(start, match);
        }

        state.pos = match + closeDelim.length;
        return true;
    };
}

/** Build the block rule for one plugin instance. See createInlineRule. */
function createBlockRule(displayMath: plugin.Delimiter[]) {
    return function math_block(state: StateBlock, start: number, end: number, silent: boolean): boolean {
        let next: number, lastPos: number;
        let found = false, pos = state.bMarks[start] + state.tShift[start], max = state.eMarks[start], lastLine = "";

        let matched: plugin.Delimiter | null = null;
        for (const pair of displayMath) {
            if (state.src.startsWith(pair[0], pos)) {
                matched = pair;
                break;
            }
        }
        if (!matched) {
            return false;
        }

        const [openDelim, closeDelim] = matched;

        if (pos + openDelim.length > max) {
            return false;
        }

        pos += openDelim.length;
        let firstLine = state.src.slice(pos, max);

        if (silent) {
            return true;
        }

        // Formula opened and closed on the same line
        if (firstLine.trim().slice(-closeDelim.length) === closeDelim) {
            firstLine = firstLine.trim().slice(0, -closeDelim.length);
            found = true;
        }

        // Otherwise scan forward for the line carrying the closing delimiter
        for (next = start; !found;) {
            next++;
            if (next >= end) {
                break;
            }
            pos = state.bMarks[next] + state.tShift[next];
            max = state.eMarks[next];
            if (pos < max && state.tShift[next] < state.blkIndent) {
                // non-empty line with negative indent should stop the list:
                break;
            }
            if (state.src.slice(pos, max).trim().slice(-closeDelim.length) === closeDelim) {
                lastPos = state.src.slice(0, max).lastIndexOf(closeDelim);
                lastLine = state.src.slice(pos, lastPos);
                found = true;
            }
        }

        // When no closing delimiter turns up, `next` has already run one line
        // past the end of the block; clamping keeps the parser from skipping a
        // line that belongs to whatever follows.
        state.line = found ? next + 1 : end;

        const token = state.push("math_block", "math", 0);
        token.block = true;
        token.content =
            (firstLine && firstLine.trim() ? firstLine + "\n" : "") +
            state.getLines(start + 1, next, state.tShift[start], true) +
            (lastLine && lastLine.trim() ? lastLine : "");
        token.map = [start, state.line];
        token.markup = openDelim;
        token.info = closeDelim;
        return true;
    };
}

function collectMathTokens(tokens: Token[] | null, collected: Token[]): void {
    if (!tokens) {
        return;
    }
    for (const token of tokens) {
        if (token.type === "math_inline" || token.type === "math_block") {
            collected.push(token);
        }
        collectMathTokens(token.children, collected);
    }
}

function extractCssFromStyleTag(str: string): string {
    const match = str.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    return match ? match[1] : str;
}

/**
 * Render every formula on the page through a single MathJax document. Sharing
 * one document is what makes the batch worthwhile: the output jax emits one
 * stylesheet for the whole page, and a macro defined in one formula stays
 * visible to the next.
 */
function renderMathTokens(state: StateCore, documentOptions: any, outputJax: any): void {
    const mathTokens: Token[] = [];
    collectMathTokens(state.tokens, mathTokens);

    if (mathTokens.length === 0) {
        return;
    }

    const adaptor = getAdaptor();
    const mathDocument = mathjax.document("", documentOptions);

    for (const token of mathTokens) {
        const display = token.type === "math_block";
        let html: string;
        try {
            html = adaptor.outerHTML(mathDocument.convert(token.content, { display }) as any);
        } catch (error) {
            // One unparseable formula must not take the whole page down. Fall
            // back to the escaped source so the author can see what broke.
            const source = escapeHtml(token.markup + token.content + token.info);
            const reason = escapeAttribute(error instanceof Error ? error.message : String(error));
            html = `<span class="math-error" title="${reason}">${source}</span>`;
        }
        token.type = display ? "html_block" : "html_inline";
        token.content = html;
    }

    state.env.mathjax_stylesheet = extractCssFromStyleTag(adaptor.outerHTML(outputJax.styleSheet(mathDocument)));
}

/**
 * Add to `env.frontmatter.inject_content` instead of replacing it, so a page
 * that already collected head entries from another plugin keeps them. Entries
 * contributed by an earlier render through the same env are dropped first, so
 * reusing an env cannot stack duplicates.
 */
function appendInjectContent(state: StateCore, entries: plugin.InjectEntry[]): void {
    const env = state.env;
    if (!env) {
        return;
    }
    if (!env.frontmatter) {
        env.frontmatter = {};
    }
    const existing: plugin.InjectEntry[] = Array.isArray(env.frontmatter.inject_content)
        ? env.frontmatter.inject_content
        : [];
    const previous: plugin.InjectEntry[] = Array.isArray(env.mathjax_inject_content)
        ? env.mathjax_inject_content
        : [];
    env.mathjax_inject_content = entries;
    env.frontmatter.inject_content = existing.filter(entry => previous.indexOf(entry) === -1).concat(entries);
}

function setupServerSide(md: MarkdownIt, options: plugin.Options): void {
    const outputJax = options.svg
        ? new SVG(Object.assign({ fontCache: "local", displayAlign: "center" }, options.svg))
        : new CHTML(Object.assign({ fontURL: DEFAULT_CHTML_FONT_URL }, options.chtml));

    const documentOptions = {
        InputJax: new TeX(Object.assign({ packages: AllPackages }, options.tex)),
        OutputJax: outputJax,
    };

    md.core.ruler.push("mathjax_render", (state) => {
        state.env.mathjax_stylesheet = null;
        renderMathTokens(state, documentOptions, outputJax);
        return true;
    });

    md.core.ruler.push("mathjax_inject_content", (state) => {
        if (state.env && state.env.mathjax_stylesheet) {
            appendInjectContent(state, [{
                type: "style",
                contribution: { type: "text/css" },
                content: state.env.mathjax_stylesheet,
            }]);
        }
        return true;
    });
}

function setupClientSide(
    md: MarkdownIt,
    options: plugin.Options,
    inlineMath: plugin.Delimiter[],
    displayMath: plugin.Delimiter[]
): void {
    const texConfig = Object.assign({}, options.tex, { inlineMath, displayMath });
    const mathjaxOptions = Object.assign({ enableMenu: true }, options.mathjax_options);
    const clientConfig =
        `window.MathJax = {\n` +
        `  tex: ${toScriptJson(texConfig)},\n` +
        `  options: ${toScriptJson(mathjaxOptions)}\n` +
        `};`;

    // The parser rules registered by `plugin` are what keep markdown-it from
    // reading '*', '_' or '\\' inside a formula as Markdown syntax. These
    // renderers then write the source back out verbatim, so the MathJax script
    // running in the browser receives exactly what the author typed.
    md.renderer.rules.math_inline = (tokens, idx) => {
        const token = tokens[idx];
        return escapeHtml(token.markup + token.content + token.info);
    };
    md.renderer.rules.math_block = (tokens, idx) => {
        const token = tokens[idx];
        return `<p>${escapeHtml(token.markup + "\n" + token.content + token.info)}</p>\n`;
    };

    md.core.ruler.push("mathjax_inject_content", (state) => {
        appendInjectContent(state, [
            {
                type: "script",
                contribution: { type: "text/javascript" },
                content: clientConfig,
            },
            {
                type: "script",
                contribution: {
                    async: true,
                    src: DEFAULT_MATHJAX_CDN,
                    id: "MathJax-script",
                },
            },
        ]);
        return true;
    });
}

function plugin(md: MarkdownIt, options?: plugin.Options): void {
    const opts: plugin.Options = options || {};
    const tex = opts.tex || {};
    const inlineMath = normalizeDelimiters(tex.inlineMath, DEFAULT_INLINE_MATH);
    const displayMath = normalizeDelimiters(tex.displayMath, DEFAULT_DISPLAY_MATH);

    // Both modes parse math identically; only the renderer differs. Parsing in
    // client-side mode too is what stops Markdown from mangling formula source
    // before the browser's MathJax ever sees it.
    md.inline.ruler.before("text", "math_inline", createInlineRule(inlineMath));
    md.block.ruler.after("blockquote", "math_block", createBlockRule(displayMath), {
        alt: ["paragraph", "reference", "blockquote", "list"],
    });

    if (opts.user_side) {
        setupClientSide(md, opts, inlineMath, displayMath);
    } else {
        setupServerSide(md, Object.assign({}, opts, { tex: Object.assign({}, tex, { inlineMath, displayMath }) }));
    }
}

declare namespace plugin {
    /** A pair of opening and closing math delimiters, e.g. ['$', '$']. */
    type Delimiter = [string, string];

    /** One entry appended to `env.frontmatter.inject_content`. */
    interface InjectEntry {
        type: "style" | "script";
        contribution?: Record<string, unknown>;
        content?: string;
    }

    interface TexOptions {
        /** Inline delimiters. Default: [['$', '$']]. */
        inlineMath?: Delimiter[];
        /** Block delimiters. Default: [['$$', '$$']]. */
        displayMath?: Delimiter[];
        [key: string]: unknown;
    }

    interface Options {
        /** Emit formula source plus a MathJax loader instead of pre-rendering. */
        user_side?: boolean;
        /** TeX input processor options. */
        tex?: TexOptions;
        /** CHTML output options. Used when `svg` is not set. */
        chtml?: Record<string, unknown>;
        /** SVG output options. Setting this selects SVG output over CHTML. */
        svg?: Record<string, unknown>;
        /** Browser-side MathJax `options` block. Client-side mode only. */
        mathjax_options?: Record<string, unknown>;
    }
}

plugin.default = plugin;
plugin.displayName = "MarkdownItMathJaX3PRO";

export = plugin;
