import type { Clip } from '../runtime/types'
import { fxBudget } from './budget'
import { CLIP_COLOR, PALETTE } from './palette'

const COLS = 72
const ROWS = 18
const CELL = 12

function linesOf(frame: string): string[] {
  const lines = frame.replace(/\n$/, '').split('\n')
  while (lines.length < ROWS) lines.push(' '.repeat(COLS))
  return lines.slice(0, ROWS).map((line) => line.padEnd(COLS, ' ').slice(0, COLS))
}

function frameAt(clip: Clip | null, index: number): string[] | null {
  if (!clip || clip.frames.length === 0) return null
  const frame = clip.frames[((index % clip.frames.length) + clip.frames.length) % clip.frames.length]
  return linesOf(frame)
}

function shiftRows(lines: string[], salt: number): string[] {
  return lines.map((line, y) => {
    if ((y + salt) % 5 !== 0) return line
    const shift = 1 + (salt + y) % 3
    return line.slice(shift) + line.slice(0, shift)
  })
}

export class Stage {
  private reduced = false
  private ambient: Clip | null = null
  private clip: Clip | null = null
  private raf = 0
  private shakeUntil = 0
  private flashUntil = 0
  private glitchLeft = 0
  private glitchSalt = 1
  private glitchColorOnly = false
  private cell = CELL

  constructor(private canvas: HTMLCanvasElement) {}

  setReduced(on: boolean) {
    this.reduced = on
  }

  setClips(ambient: Clip | null, clip: Clip | null) {
    this.ambient = ambient
    this.clip = clip
  }

  trigger(fx: string | null) {
    if (!fx) return
    const budget = fxBudget(this.reduced)
    const now = performance.now()
    if (fx === 'shake') this.shakeUntil = now + budget.shakeMs
    if (fx === 'flash' && budget.flashMs > 0) this.flashUntil = now + budget.flashMs
    if (fx === 'glitch') {
      const span = budget.glitchMax - budget.glitchMin + 1
      this.glitchLeft = budget.glitchMin + Math.floor(Math.random() * span)
      this.glitchSalt = 1 + Math.floor(Math.random() * 20)
      this.glitchColorOnly = budget.glitchColorOnly
      this.lastGlitchIndex = -1
    }
  }

  start() {
    if (this.raf) return
    const loop = (now: number) => {
      this.draw(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private fit() {
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))
    const parent = this.canvas.parentElement?.clientWidth ?? COLS * CELL
    const natural = COLS * CELL
    const scale = Math.min(1, parent / natural)
    this.canvas.style.width = `${Math.floor(natural * scale)}px`
    this.canvas.style.height = `${Math.floor(ROWS * CELL * scale)}px`
    this.canvas.width = natural * dpr
    this.canvas.height = ROWS * CELL * dpr
    this.cell = CELL
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return null
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return ctx
  }

  private draw(now: number) {
    const ctx = this.fit()
    if (!ctx) return
    const budget = fxBudget(this.reduced)
    const width = COLS * this.cell
    const height = ROWS * this.cell
    ctx.fillStyle = PALETTE.bg
    ctx.fillRect(0, 0, width, height)

    const index = Math.floor(now / budget.frameMs)
    const blend = budget.crossfade ? (now % budget.frameMs) / budget.frameMs : 1
    let shake = 0
    if (!this.reduced && now < this.shakeUntil) {
      const left = (this.shakeUntil - now) / budget.shakeMs
      shake = left * budget.shakeCells * this.cell
    }
    const ox = Math.round(Math.sin(now / 28) * shake)
    const oy = Math.round(Math.cos(now / 36) * shake)

    const glitchOn = this.glitchLeft > 0
    this.paintLayer(ctx, this.ambient, index, blend, ox, oy, false, glitchOn)
    this.paintLayer(ctx, this.clip, index, blend, ox, oy, true, glitchOn)
    if (glitchOn && index !== this.lastGlitchIndex) {
      this.lastGlitchIndex = index
      this.glitchLeft -= 1
    }

    if (!this.reduced && now < this.flashUntil) {
      ctx.fillStyle = PALETTE.flash
      ctx.globalAlpha = 0.82
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }
  }

  private lastGlitchIndex = -1

  private paintLayer(
    ctx: CanvasRenderingContext2D,
    clip: Clip | null,
    index: number,
    blend: number,
    ox: number,
    oy: number,
    skipSpace: boolean,
    glitchOn: boolean,
  ) {
    if (!clip) return
    const color = glitchOn && this.glitchColorOnly ? PALETTE.memory : CLIP_COLOR[clip.id] ?? PALETTE.paper
    const draw = (lines: string[] | null, alpha: number) => {
      if (!lines || alpha <= 0) return
      const shown = glitchOn && !this.glitchColorOnly ? shiftRows(lines, this.glitchSalt) : lines
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.font = `${this.cell - 1}px "JetBrains Mono", ui-monospace, monospace`
      ctx.textBaseline = 'top'
      for (let y = 0; y < ROWS; y += 1) {
        const line = shown[y] ?? ''
        for (let x = 0; x < COLS; x += 1) {
          const ch = line[x] ?? ' '
          if (skipSpace && ch === ' ') continue
          ctx.fillText(ch, ox + x * this.cell, oy + y * this.cell)
        }
      }
      ctx.globalAlpha = 1
    }
    if (blend >= 1) {
      draw(frameAt(clip, index), 1)
      return
    }
    draw(frameAt(clip, index - 1), 1 - blend)
    draw(frameAt(clip, index), blend)
  }
}
