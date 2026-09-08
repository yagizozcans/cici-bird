'use client'

import { memo, type KeyboardEvent, type PointerEvent } from 'react'
import { STAGE, type StageLayout } from '@/lib/voice-space'

/**
 * The plot itself: one SVG, drawn from a precomputed layout.
 *
 * This component is deliberately dumb. Every coordinate arrives already
 * projected and rounded by `layoutVoiceSpace`, so the server can render the
 * resting frame — a visitor without JavaScript sees the real plot, not a
 * placeholder — and the client's first frame is byte-identical to it.
 *
 * It is memoised because the parent re-renders on every animation frame
 * while audio plays (that is how the playhead reaches the subtitle bar), but
 * this SVG only needs to change when the view is dragged or a letter starts
 * or stops sounding — roughly ten times a second, not sixty.
 *
 * What is NOT here, on purpose: a wireframe cube, a perspective camera, a
 * zoom control. Three axes from one corner, a drop-line under each point and
 * a dashed line where "flat" sits are enough to read height and depth, and
 * every extra line made the earlier prototype harder to read, not easier.
 */

export interface StageLabels {
  slope: string
  slopeUnit: string
  duration: string
  durationUnit: string
  pitch: string
  pitchUnit: string
  ariaLabel: string
  pointLabelPrefix: string
  spaceGlyph: string
}

interface Props {
  layout: StageLayout
  /** Letter index currently sounding, or −1. */
  activeIndex: number
  /** Letter indices sung so far, in order. */
  trail: number[]
  /** Letter index the visitor picked, or −1. */
  selected: number
  accent: string
  /** The stage background, painted behind label text so a label that a
   *  rotation brings over a point or a drop-line stays readable. */
  halo: string
  labels: StageLabels
  onSelect: (index: number) => void
  onPointerDown: (e: PointerEvent<SVGSVGElement>) => void
  onPointerMove: (e: PointerEvent<SVGSVGElement>) => void
  onPointerUp: (e: PointerEvent<SVGSVGElement>) => void
  onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => void
}

const LINE = '#E4E0D6'
const INK = '#16150F'

function VoiceSpaceStageImpl({
  layout,
  activeIndex,
  trail,
  selected,
  accent,
  halo,
  labels,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onKeyDown,
}: Props) {
  const { points, order, axes, zeroTick } = layout
  const trailPoints = trail.map((i) => `${points[i].x},${points[i].y}`).join(' ')

  const axisList = [
    { a: axes.slope, label: labels.slope, unit: labels.slopeUnit },
    { a: axes.pitch, label: labels.pitch, unit: labels.pitchUnit },
    { a: axes.duration, label: labels.duration, unit: labels.durationUnit },
  ]

  return (
    <svg
      viewBox={`0 0 ${STAGE.width} ${STAGE.height}`}
      role="group"
      aria-label={labels.ariaLabel}
      tabIndex={0}
      // touch-none on the plot only: a thumb on the plot rotates it, a thumb
      // beside it scrolls the page as usual.
      className="h-auto w-full touch-none select-none rounded-lg cursor-grab focus:outline-none focus-visible:ring-2 focus-visible:ring-ochre active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      <defs>
        {/* Arrowhead for the three axes; fill is the ink token's hex because
            markers cannot take a Tailwind class through the stroke. */}
        <marker
          id="vs-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="9"
          markerHeight="9"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0.5 L10,5 L0,9.5 Z" fill={INK} />
        </marker>
      </defs>

      {/* The "flat" line across the floor, under everything. */}
      <line
        x1={zeroTick.x1}
        y1={zeroTick.y1}
        x2={zeroTick.x2}
        y2={zeroTick.y2}
        stroke={LINE}
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      {/* The three axes: ink, arrowed, from a shared origin, each with its
          name past the tip. In the resting isometric view all three arrows
          are the same length and 120° apart — that is the triad, and it is
          meant to be the first thing read.

          An axis pointing at the viewer has nothing left to draw and no
          direction to hang its name on, so it fades out over its last ~30 px
          instead of collapsing to a stub at the origin. That happens at both
          ends of the elevation range and whenever a view is locked to an
          axis, which is exactly when the plot has become a flat scatter of
          the other two. */}
      {axisList.map(({ a, label, unit }, i) => {
        const shown = Math.max(0, Math.min(1, (a.len - 8) / 30))
        if (shown <= 0) return null
        return (
          <g key={i} opacity={shown}>
            <line
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke={INK}
              strokeWidth="1.75"
              strokeLinecap="round"
              markerEnd="url(#vs-arrow)"
            />
            <text
              x={a.lx}
              y={a.ly}
              textAnchor={a.anchor}
              className="fill-ink text-[13px] font-semibold"
              paintOrder="stroke"
              stroke={halo}
              strokeWidth="5"
              strokeLinejoin="round"
            >
              {label}
              <tspan
                x={a.lx}
                dy="13"
                className="fill-muted font-mono text-[10px] font-normal"
              >
                {unit}
              </tspan>
            </text>
            {[a.lo, a.hi].map((t, j) => (
              <text
                key={j}
                x={t.x}
                y={t.y}
                textAnchor={t.anchor}
                dominantBaseline="middle"
                className="fill-muted font-mono text-[9px]"
                paintOrder="stroke"
                stroke={halo}
                strokeWidth="4"
                strokeLinejoin="round"
              >
                {t.text}
              </text>
            ))}
          </g>
        )
      })}
      <circle cx={axes.slope.x1} cy={axes.slope.y1} r="3" fill={INK} />

      {/* Drop-lines: the only cue for height that survives rotation. */}
      <g fill="none">
        {points.map((p) => (
          <line
            key={p.i}
            x1={p.x}
            y1={p.y}
            x2={p.floorX}
            y2={p.floorY}
            stroke={p.i === activeIndex ? accent : LINE}
            strokeWidth={p.i === activeIndex ? 1.25 : 0.75}
          />
        ))}
      </g>

      {/* The path the message has taken so far. */}
      {trail.length > 1 && (
        <polyline
          points={trailPoints}
          fill="none"
          stroke={accent}
          strokeWidth="1.5"
          strokeOpacity="0.55"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Points, farthest first so nearer ones paint on top. */}
      {order.map((i) => {
        const p = points[i]
        const isActive = i === activeIndex
        const isSelected = i === selected && !isActive
        const glyph = p.ch === ' ' ? '␣' : p.ch
        const name = p.ch === ' ' ? labels.spaceGlyph : p.ch
        return (
          <g
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`${labels.pointLabelPrefix} ${name}`}
            aria-pressed={i === selected}
            className="cursor-pointer focus:outline-none [&:focus-visible>circle:last-of-type]:stroke-ochre"
            onClick={() => onSelect(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(i)
              }
            }}
          >
            {(isActive || isSelected) && (
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r + 5}
                fill="none"
                stroke={isActive ? accent : INK}
                strokeOpacity={isActive ? 1 : 0.4}
                strokeWidth="1.5"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={isActive ? p.r + 1.5 : p.r}
              fill={p.fill}
              fillOpacity={0.55 + 0.45 * (1 - p.depth)}
              stroke="none"
              // The size change on activation is a CSS transition, which
              // globals.css already collapses under prefers-reduced-motion.
              // Keep it that way: no requestAnimationFrame loop lives here.
              style={{ transition: 'r 120ms ease-out' }}
            />
            <text
              x={p.x + p.r + 3}
              y={p.y + 3.5}
              className={`pointer-events-none font-mono text-[10px] ${
                isActive ? 'fill-ink font-semibold' : 'fill-muted'
              }`}
            >
              {glyph}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export const VoiceSpaceStage = memo(VoiceSpaceStageImpl)
