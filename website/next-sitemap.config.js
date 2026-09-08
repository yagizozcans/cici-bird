/**
 * Sitemap + robots generation, run from `postbuild`.
 *
 * Everything is anchored on cicibird.com. This site is a sibling of
 * cicicv.com, not a child of it, so no cicicv.com host ever appears here.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://cicibird.com'

/**
 * Species pages whose voice is not trained yet.
 *
 * Read from the audio manifest, which is the same source src/data/species.ts
 * uses for `hasTrainedVoice` — a hand-kept second list here would go stale the
 * first time a model finished. These pages exist and render; they are noindex,
 * and nothing on the site links to them, so a sitemap entry would be the one
 * remaining way for a visitor to reach a page of placeholder numbers.
 */
const manifest = require('./public/audio/manifest.json')
const trained = new Set(Object.keys(manifest.trainedVoices || {}))
const untrainedSpeciesPaths = []
for (const slug of Object.keys(manifest.voiceProfiles || {})) {
  if (trained.has(slug)) continue
  untrainedSpeciesPaths.push(`/species/${slug}`, `/tr/species/${slug}`)
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  outDir: 'public',
  exclude: [
    // /m/:id links are unguessable, private-by-default and revocable
    // (website.md §4). Indexing them would defeat every one of those.
    '/m/*',
    '/tr/m/*',
    // Generated OG cards are images referenced by a page's metadata, not
    // pages. next-sitemap sees them as routes because they are; listing them
    // would put a PNG endpoint in the index next to the page it illustrates.
    '*/opengraph-image*',
    // v1.1 placeholders. They are noindex, and a sitemap entry for a page we
    // are asking robots not to index is a contradiction crawlers report.
    '/account',
    '/blog',
    '/press',
    '/tr/account',
    '/tr/blog',
    '/tr/press',
    // Species pages still waiting on a trained voice — see above.
    ...untrainedSpeciesPaths,
  ],
  robotsTxtOptions: {
    policies: [{ userAgent: '*', allow: '/', disallow: ['/m/'] }],
    additionalSitemaps: [`${SITE_URL}/sitemap.xml`],
  },
  transform: async (config, path) => {
    const priority =
      path === '/' ? 1.0
      : path === '/species' ? 0.9
      : path.startsWith('/species/') ? 0.8
      : path === '/lab' || path.startsWith('/lab/') ? 0.6
      : path.startsWith('/tr') ? 0.5
      : 0.3
    return {
      // Explicit trailing slash on the root so the sitemap entry matches the
      // canonical link the page itself emits.
      loc: path === '/' ? `${SITE_URL}/` : path,
      changefreq: path.startsWith('/species') ? 'weekly' : 'monthly',
      priority,
      lastmod: new Date().toISOString(),
      alternateRefs: [
        { href: `${SITE_URL}${path.replace(/^\/tr/, '') || '/'}`, hreflang: 'en' },
        { href: `${SITE_URL}/tr${path.replace(/^\/tr/, '')}`, hreflang: 'tr' },
      ],
    }
  },
}
