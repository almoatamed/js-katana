import MarkdownIt from "markdown-it";
import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js"; // note the .js
import QuickLRU from "quick-lru";

// ---------- Configuration ----------
const CACHE_SIZE = 200; // adjust based on memory
const ENABLE_CACHE = true;
const LANGS_TO_LOAD = ["javascript", "ts", "typescript", "bash", "json", "css", "html", "python", "java"];

loadLanguages(LANGS_TO_LOAD);

const cache = new QuickLRU<string, string>({ maxSize: CACHE_SIZE, maxAge: 3600e3 });

// ---------- markdown-it with fast highlight function ----------
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: (code: string, lang: string) => {
        try {
            const language = lang && Prism.languages[lang] ? lang : "none";
            if (language === "none") {
                // escaped and wrapped (no highlight)
                return `<pre class="language-none"><code>${md.utils.escapeHtml(code)}</code></pre>`;
            }
            const highlighted = Prism.highlight(code, Prism.languages[language], language);
            return `<pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre>`;
        } catch {
            // fallback
            return `<pre class="language-fallback"><code>${md.utils.escapeHtml(code)}</code></pre>`;
        }
    },
});

export function escapeHtml(s: string) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- Render function with cache ----------
export function renderMarkdown(markdownSource: string) {
    const key = markdownSource; // for more safety you can hash this
    if (ENABLE_CACHE) {
        const cached = cache.get(key);
        if (cached) return cached;
    }

    // markdown-it.render is synchronous and very fast
    const bodyHtml = md.render(markdownSource);
    if (ENABLE_CACHE) cache.set(key, bodyHtml);
    return bodyHtml;
}
