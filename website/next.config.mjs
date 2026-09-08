/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Audio is content-addressed by the asset build and never mutates in
        // place, so it can be cached hard. website.md §8 wants it streamed
        // from a CDN rather than pulled down with the document; Accept-Ranges
        // is what lets the browser start playback before the file is complete.
        source: '/audio/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'Accept-Ranges', value: 'bytes' },
        ],
      },
    ]
  },
}

export default nextConfig
