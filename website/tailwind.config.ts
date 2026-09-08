import type { Config } from 'tailwindcss'
import { SANS_STACK } from './src/lib/fonts'

/**
 * CICI BIRD's palette.
 *
 * The CICI house style — as seen on the sibling project cicicv.com — is
 * minimal, light, high-contrast, one accent colour, generous whitespace,
 * lowercase wordmark. CICI BIRD keeps that grammar and changes the vocabulary:
 * cicicv.com's accent is green, so this project takes a warm ochre against a
 * paper-white ground. Field-guide, not SaaS. Same family, own identity.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FBFAF7',   // page ground — warm off-white, not pure #fff
        ink: '#16150F',     // primary text
        muted: '#6B675C',   // secondary text
        line: '#E4E0D6',    // hairline borders
        ochre: '#B8791B',   // the accent: song, action, "play"
        'ochre-deep': '#8E5C10',
        moss: '#3F5940',    // secondary accent for "found in the wild"
      },
      // No webfont on the critical path — see src/lib/fonts.ts for the
      // measurement that decided it.
      fontFamily: { sans: SANS_STACK.split(', ') },
      maxWidth: { measure: '68ch' },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
}

export default config
