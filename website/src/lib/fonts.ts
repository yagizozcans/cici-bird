/**
 * Typography.
 *
 * THERE IS NO WEBFONT, AND THAT IS A MEASURED DECISION.
 *
 * This site was built with Inter loaded through next/font. It looked good and
 * it cost 134 KB across two woff2 files (latin + latin-ext, the second
 * non-negotiable for ı ğ ş ç ö ü). On Lighthouse's throttled mobile profile
 * that put the landing page's LCP at 2.6s against website.md §3's 2.5s
 * requirement — not because anything rendered late, but because text painted
 * at 0.9s in the fallback face and then repainted when Inter finally arrived,
 * and LCP moves with that repaint.
 *
 * The traffic this site is built for is a phone opening a shared link, often
 * on mobile data — §3 says so explicitly, and §9 expects that path to convert
 * best. Spending two seconds of that visitor's attention on a typeface is a
 * poor trade when the native UI stack is already a clean neutral sans (SF Pro
 * on Apple, Roboto on Android, Segoe UI on Windows), covers Turkish
 * completely, and costs nothing.
 *
 * If a brand face becomes a requirement later, the way to keep the budget is
 * to self-host a subset of the glyphs actually used and preload it — not to
 * add a second network dependency on the critical path.
 */
export const SANS_STACK = [
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  '"Noto Sans"',
  'sans-serif',
].join(', ')
