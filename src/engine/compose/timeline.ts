/**
 * Sequencing data model. Pure functions, no GL, so it is unit-testable and
 * can be shared with a future timeline UI and the exporter.
 */
import type { ParamValue } from '../params';
import type { BlendMode } from './compositor';

export interface Clip {
  id: string;
  moduleId: string;
  /** Seconds on the timeline. */
  start: number;
  end: number;
  /** Param overrides applied while the clip is active. */
  params?: Record<string, ParamValue>;
  /** Optional linear fades, seconds. */
  fadeIn?: number;
  fadeOut?: number;
  blend?: BlendMode;
  track: number;
}

export interface Timeline {
  duration: number;
  clips: Clip[];
}

export interface ActiveClip {
  clip: Clip;
  /** 0..1 progress through the clip. */
  progress: number;
  /** Opacity after fades. */
  opacity: number;
  /** Local time in seconds since the clip started. */
  localTime: number;
}

/** Clips active at `t`, ordered by track (lower tracks first = bottom). */
export function clipsAt(timeline: Timeline, t: number): ActiveClip[] {
  const out: ActiveClip[] = [];
  for (const clip of timeline.clips) {
    if (t < clip.start || t >= clip.end) continue;
    const len = clip.end - clip.start;
    const local = t - clip.start;
    let opacity = 1;
    if (clip.fadeIn && local < clip.fadeIn) opacity = Math.min(opacity, local / clip.fadeIn);
    if (clip.fadeOut && len - local < clip.fadeOut) opacity = Math.min(opacity, (len - local) / clip.fadeOut);
    out.push({ clip, progress: len > 0 ? local / len : 1, opacity, localTime: local });
  }
  return out.sort((a, b) => a.clip.track - b.clip.track);
}

export function timelineDuration(timeline: Timeline): number {
  return Math.max(timeline.duration, ...timeline.clips.map((c) => c.end));
}
