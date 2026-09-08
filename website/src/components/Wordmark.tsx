/**
 * The CICI BIRD wordmark.
 *
 * The CICI house mark is a lowercase wordmark (see the sibling project
 * cicicv.com). CICI BIRD inherits the lowercase treatment and adds one
 * distinguishing element: the accent-coloured mark before "bird" is a single
 * note rising and falling — the glide contour every voice profile in
 * engine/voices.py is built around. Same family, own identity.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span className="text-[15px] font-semibold tracking-tight text-ink">cici</span>
      <svg
        width="16"
        height="10"
        viewBox="0 0 16 10"
        fill="none"
        aria-hidden="true"
        className="translate-y-[-1px]"
      >
        <path
          d="M1 8.4C3.2 2.2 5.4 1 8 1s4.8 1.2 7 7.4"
          stroke="#B8791B"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-ink">bird</span>
      <span className="sr-only">CICI BIRD</span>
    </span>
  )
}
