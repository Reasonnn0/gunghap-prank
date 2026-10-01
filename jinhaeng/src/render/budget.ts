export type FxBudget = {
  shakeCells: number
  shakeMs: number
  flashMs: number
  glitchMin: number
  glitchMax: number
  glitchColorOnly: boolean
  frameMs: number
  crossfade: boolean
}

export function fxBudget(reduced: boolean): FxBudget {
  if (reduced) {
    return {
      shakeCells: 0,
      shakeMs: 400,
      flashMs: 0,
      glitchMin: 1,
      glitchMax: 1,
      glitchColorOnly: true,
      frameMs: 600,
      crossfade: true,
    }
  }
  return {
    shakeCells: 1,
    shakeMs: 400,
    flashMs: 80,
    glitchMin: 2,
    glitchMax: 4,
    glitchColorOnly: false,
    frameMs: 1000 / 12,
    crossfade: false,
  }
}
