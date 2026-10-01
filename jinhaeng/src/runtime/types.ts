export type Stats = {
  body: number
  memory: number
  food: number
  water: number
  cell: number
}

export type AxisValue = string | boolean | number

export type Effect =
  | { op: 'stat.add'; stat: keyof Stats; delta: number }
  | { op: 'axis.set'; key: string; value: AxisValue }
  | { op: 'color.set'; key: string; value: boolean }
  | { op: 'item.add'; id: string }
  | { op: 'item.remove'; id: string }
  | { op: 'noise.add'; delta: number }
  | { op: 'fx.play'; fx: string }

export type Cond =
  | { op: 'stat.cmp'; stat: keyof Stats; cmp: 'gte' | 'lte' | 'eq'; value: number }
  | { op: 'item.has'; id: string }
  | { op: 'item.missing'; id: string }
  | { op: 'axis.eq'; key: string; value: AxisValue }
  | { op: 'color.eq'; key: string; value: boolean }
  | { op: 'ap.gte'; n: number }

export type TextVariant = { when?: Cond[]; body: string }

export type Choice = {
  id: string
  label: string
  cost?: number
  when?: Cond[]
  effects?: Effect[]
  goto: string
  fx?: string
}

export type EncounterWhen = {
  noiseMin?: number
  noiseMax?: number
  missing?: string
  has?: string
}

export type EncounterCard = {
  id: string
  weight: number
  when?: EncounterWhen
  text: string
  effects?: Effect[]
}

export type EncounterDeck = { id: string; cards: EncounterCard[] }

export type Presentation = { clip?: string; ambient?: string }

export type Node = {
  id: string
  day?: number
  site?: string
  shelter?: boolean
  outdoor?: boolean
  encounter?: string
  kind?: 'ending' | 'vital' | 'checkpoint'
  presentation?: Presentation
  text: string | TextVariant[]
  onEnter?: Effect[]
  choices?: Choice[]
}

export type Clip = {
  id: string
  fps: number
  loop: boolean
  frames: string[]
}

export type FlagDef = { id: string; group: 'axis' | 'color'; type: string; note: string }

export type Content = {
  nodes: Record<string, Node>
  encounters: Record<string, EncounterDeck>
  clips: Record<string, Clip>
  flags: FlagDef[]
}

export type RunState = {
  version: 1
  nodeId: string
  day: number
  ap: number
  stats: Stats
  inventory: string[]
  axis: Record<string, AxisValue>
  color: Record<string, boolean>
  noise: number
  rng: { seed: number; cursor: number }
  lead: string
  pendingFx: string | null
  closed: boolean
  endingId: string | null
}

export const SAVE_KEY = 'jg.account'
export const SAVE_VERSION = 1

export const LIMITS: Record<keyof Stats, number> = {
  body: 100,
  memory: 100,
  food: 6,
  water: 6,
  cell: 4,
}
