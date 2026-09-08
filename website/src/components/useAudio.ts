'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { track, type AnalyticsEvent } from '@/lib/analytics'

/**
 * One playing clip, created lazily.
 *
 * TWO REQUIREMENTS SHAPE THIS HOOK, both from website.md §3:
 *
 *  1. "Audio must not autoplay." Nothing here ever calls play() outside a user
 *     gesture handler.
 *  2. "Audio assets lazy-loaded on interaction." The Audio element is not
 *     constructed until the first play. `preload="none"` on a rendered <audio>
 *     tag is weaker than it looks — browsers still fetch metadata in some
 *     conditions, and a landing page with eleven players would open eleven
 *     speculative connections. Constructing on demand makes the guarantee
 *     absolute, and is why the LCP budget survives a page full of samples.
 *
 * Position is tracked from TWO sources, and it needs both. The codec's symbol
 * grid is 120 ms per character, so `timeupdate` alone — which fires roughly
 * every 250 ms — would drop every other character of the subtitle. But
 * requestAnimationFrame alone is worse in a different way: browsers throttle
 * it to nothing in a hidden or backgrounded tab, so a listener who switches
 * tabs mid-message comes back to audio that has moved on and a subtitle frozen
 * where they left it. rAF drives the smooth 60 fps reveal while the page is
 * visible; `timeupdate` keeps the position honest regardless.
 */

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

interface Options {
  src: string
  /** Manifest duration, so the progress bar is correct before metadata loads. */
  durationSec?: number
  /** Fired once, on the first successful play of this clip. */
  analyticsEvent?: AnalyticsEvent
  analyticsProps?: Record<string, string | number | boolean>
  /** Called when playback reaches the end. */
  onEnded?: () => void
}

export function useAudio({
  src,
  durationSec = 0,
  analyticsEvent,
  analyticsProps,
  onEnded,
}: Options) {
  const elementRef = useRef<HTMLAudioElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const reportedRef = useRef(false)
  // Kept in a ref so the callbacks below stay stable even when a parent
  // re-renders with a fresh inline props object.
  const endedRef = useRef(onEnded)
  endedRef.current = onEnded

  const [state, setState] = useState<PlayerState>('idle')
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(durationSec)

  const stopTicking = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const startTicking = useCallback(() => {
    stopTicking()
    const tick = () => {
      const el = elementRef.current
      if (el) setPosition(el.currentTime)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
  }, [stopTicking])

  // Tear down on unmount so a player scrolled out of a filtered catalog does
  // not keep a decoder and an rAF loop alive.
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      frameRef.current = null
      const el = elementRef.current
      if (el) {
        el.pause()
        el.removeAttribute('src')
        el.load()
      }
      elementRef.current = null
    }
  }, [])

  const ensureElement = useCallback((): HTMLAudioElement => {
    if (elementRef.current) return elementRef.current
    const el = new Audio()
    el.preload = 'auto'
    el.src = src
    el.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDuration(el.duration)
    })
    // Coarse but always delivered, including while rAF is throttled.
    el.addEventListener('timeupdate', () => setPosition(el.currentTime))
    // A finished clip STAYS finished: the playhead is left at the end, the
    // bar full, the read-out on the last second. Rewinding here threw
    // away the one thing the listener had just earned — the subtitle's last
    // word, the Lab's completed trail — a beat after they got it.
    el.addEventListener('ended', () => {
      stopTicking()
      setState('paused')
      // `timeupdate` at the end is not guaranteed to land exactly on the
      // duration, so take it from the element and let the bar fill.
      setPosition(el.currentTime)
      endedRef.current?.()
    })
    el.addEventListener('error', () => {
      stopTicking()
      setState('error')
    })
    elementRef.current = el
    return el
  }, [src, stopTicking])

  const play = useCallback(async () => {
    const el = ensureElement()
    // Playing a finished clip replays it: the element seeks to the start on
    // its own (HTMLMediaElement's play() algorithm does this), but `position`
    // would sit at the end until the first tick — one frame of a full bar
    // under a playing button. Clear it here instead.
    if (el.ended) setPosition(0)
    if (el.readyState < 2) setState('loading')
    try {
      await el.play()
      setState('playing')
      startTicking()
      if (analyticsEvent && !reportedRef.current) {
        reportedRef.current = true
        track(analyticsEvent, analyticsProps)
      }
    } catch {
      // A rejected play() is almost always the browser refusing a gesture-less
      // call, or the tab being backgrounded. Neither is worth an error state.
      setState('paused')
    }
  }, [ensureElement, startTicking, analyticsEvent, analyticsProps])

  const pause = useCallback(() => {
    elementRef.current?.pause()
    stopTicking()
    setState('paused')
  }, [stopTicking])

  const toggle = useCallback(() => {
    if (state === 'playing') pause()
    else void play()
  }, [state, play, pause])

  const seek = useCallback((seconds: number) => {
    const el = elementRef.current
    if (!el) return
    el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds))
    setPosition(el.currentTime)
  }, [])

  const restart = useCallback(() => {
    seek(0)
    void play()
  }, [seek, play])

  return {
    state,
    position,
    duration: duration || durationSec,
    isPlaying: state === 'playing',
    play,
    pause,
    toggle,
    seek,
    restart,
  }
}

/** What `useAudio` hands back — so a component that owns the player can pass
 *  it to `AudioPlayerView` and to a sibling that needs `position` and `seek`
 *  (the Lab's voice space is the first). */
export type AudioController = ReturnType<typeof useAudio>
