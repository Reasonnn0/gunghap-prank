import type { Choice, Cond, Content, Effect, EncounterCard, RunState, Stats } from './types'
import { LIMITS } from './types'

const STAT_KEYS: (keyof Stats)[] = ['body', 'memory', 'food', 'water', 'cell']

export function initialState(seed = 1): RunState {
  return {
    version: 1,
    nodeId: 'D01_WAKE',
    day: 1,
    ap: 3,
    stats: { body: 80, memory: 80, food: 3, water: 3, cell: 2 },
    inventory: ['lamp', 'memo', 'rope'],
    axis: {
      voice_policy: 'none',
      said_own_name: false,
      water_route: 'none',
      companion: 'none',
      resolution: 'none',
      refused_biri: false,
    },
    color: { lock_open: false },
    noise: 0,
    rng: { seed: seed >>> 0, cursor: 0 },
    lead: '',
    pendingFx: null,
    closed: false,
    endingId: null,
  }
}

export function nextUnit(state: RunState): number {
  const cursor = state.rng.cursor + 1
  let x = (state.rng.seed + cursor * 1664525 + 1013904223) >>> 0
  x = Math.imul(x ^ (x >>> 16), 2246822507) >>> 0
  x = Math.imul(x ^ (x >>> 13), 3266489909) >>> 0
  state.rng.cursor = cursor
  return (x >>> 0) / 4294967296
}

function clampStat(stat: keyof Stats, value: number): number {
  return Math.max(0, Math.min(LIMITS[stat], value))
}

export function matchCond(cond: Cond, state: RunState): boolean {
  if (cond.op === 'stat.cmp') {
    const v = state.stats[cond.stat]
    if (cond.cmp === 'gte') return v >= cond.value
    if (cond.cmp === 'lte') return v <= cond.value
    return v === cond.value
  }
  if (cond.op === 'item.has') return state.inventory.includes(cond.id)
  if (cond.op === 'item.missing') return !state.inventory.includes(cond.id)
  if (cond.op === 'axis.eq') return state.axis[cond.key] === cond.value
  if (cond.op === 'color.eq') return Boolean(state.color[cond.key]) === cond.value
  if (cond.op === 'ap.gte') return state.ap >= cond.n
  return false
}

function matchAll(conds: Cond[] | undefined, state: RunState): boolean {
  if (!conds || conds.length === 0) return true
  return conds.every((c) => matchCond(c, state))
}

export function applyEffects(state: RunState, effects: Effect[] | undefined): RunState {
  if (!effects) return state
  const next: RunState = {
    ...state,
    stats: { ...state.stats },
    inventory: [...state.inventory],
    axis: { ...state.axis },
    color: { ...state.color },
    rng: { ...state.rng },
  }
  for (const effect of effects) {
    if (effect.op === 'stat.add') {
      next.stats[effect.stat] = clampStat(effect.stat, next.stats[effect.stat] + effect.delta)
    } else if (effect.op === 'axis.set') {
      next.axis[effect.key] = effect.value
    } else if (effect.op === 'color.set') {
      next.color[effect.key] = effect.value
    } else if (effect.op === 'item.add') {
      if (!next.inventory.includes(effect.id) && next.inventory.length < 5) next.inventory.push(effect.id)
    } else if (effect.op === 'item.remove') {
      next.inventory = next.inventory.filter((id) => id !== effect.id)
    } else if (effect.op === 'noise.add') {
      next.noise = Math.max(0, Math.min(10, next.noise + effect.delta))
    } else if (effect.op === 'fx.play') {
      next.pendingFx = effect.fx
    }
  }
  return next
}

export function nodeText(content: Content, state: RunState): string {
  const node = content.nodes[state.nodeId]
  if (!node) return ''
  if (typeof node.text === 'string') return node.text
  for (const variant of node.text) {
    if (matchAll(variant.when, state)) return variant.body
  }
  return ''
}

export function visibleChoices(content: Content, state: RunState): Choice[] {
  if (state.closed || state.endingId) return []
  const node = content.nodes[state.nodeId]
  if (!node?.choices) return []
  return node.choices.filter((choice) => {
    const cost = choice.cost ?? 0
    if (cost > state.ap) return false
    return matchAll(choice.when, state)
  })
}

export function choiceLabel(label: string, state: RunState, index: number, total: number): string {
  if (state.stats.memory > 30) return label
  if (index !== total - 1) return label
  const chars = [...label]
  if (chars.length < 2) return '▒▒'
  const mid = Math.floor(chars.length / 2)
  chars[mid] = '▒'
  if (mid > 0) chars[mid - 1] = '▒'
  return chars.join('')
}

function dawn(state: RunState, shelter: boolean): RunState {
  const stats = { ...state.stats }
  stats.food = clampStat('food', stats.food - 1)
  stats.water = clampStat('water', stats.water - 1)
  if (state.axis.companion === 'biri') stats.water = clampStat('water', stats.water - 1)
  if (shelter) stats.body = clampStat('body', stats.body + 10)
  return {
    ...state,
    stats,
    ap: 3,
    noise: shelter ? Math.max(0, state.noise - 2) : state.noise,
  }
}

function rollEncounter(state: RunState, deckId: string, content: Content): RunState {
  const deck = content.encounters[deckId]
  if (!deck) return state
  const fitting = deck.cards.filter((card) => cardOk(card, state))
  const pool = fitting.length > 0 ? fitting : deck.cards.filter((card) => !card.when)
  if (pool.length === 0) return state
  const total = pool.reduce((sum, card) => sum + card.weight, 0)
  let roll = nextUnit(state) * total
  let picked: EncounterCard = pool[pool.length - 1]
  for (const card of pool) {
    roll -= card.weight
    if (roll <= 0) {
      picked = card
      break
    }
  }
  const next = applyEffects(state, picked.effects)
  next.lead = picked.text
  return next
}

function cardOk(card: EncounterCard, state: RunState): boolean {
  const when = card.when
  if (!when) return true
  if (when.noiseMin !== undefined && state.noise < when.noiseMin) return false
  if (when.noiseMax !== undefined && state.noise > when.noiseMax) return false
  if (when.missing && state.inventory.includes(when.missing)) return false
  if (when.has && !state.inventory.includes(when.has)) return false
  return true
}

function toEnding(state: RunState, id: string): RunState {
  const fx = id === 'END_BODY' ? 'flash' : id === 'END_MEMORY' ? 'glitch' : state.pendingFx
  return { ...state, nodeId: id, endingId: id, closed: true, lead: '', pendingFx: fx }
}

function checkVital(state: RunState): RunState {
  if (state.endingId) return state
  if (state.stats.body <= 0) return toEnding(state, 'END_BODY')
  if (state.stats.memory <= 0) return toEnding(state, 'END_MEMORY')
  return state
}

export function enterNode(content: Content, state: RunState, nodeId: string): RunState {
  const node = content.nodes[nodeId]
  if (!node) return { ...state, nodeId, lead: '', closed: true }
  let next: RunState = { ...state, nodeId, lead: '', rng: { ...state.rng } }
  if (node.day && node.day > next.day) {
    next = dawn(next, Boolean(node.shelter))
    next.day = node.day
  }
  next = applyEffects(next, node.onEnter)
  next = checkVital(next)
  if (next.endingId) return next
  if (node.outdoor) {
    const stats = { ...next.stats }
    stats.memory = clampStat('memory', stats.memory - 4)
    if (stats.water <= 0) stats.body = clampStat('body', stats.body - 25)
    if (stats.food <= 0) stats.body = clampStat('body', stats.body - 20)
    if (next.inventory.includes('lamp')) stats.cell = clampStat('cell', stats.cell - 1)
    next = { ...next, stats }
    if (node.encounter) next = rollEncounter(next, node.encounter, content)
    next = checkVital(next)
    if (next.endingId) return next
  }
  if (node.kind === 'ending' || node.kind === 'vital' || node.kind === 'checkpoint') {
    next.closed = true
    if (node.kind !== 'checkpoint') next.endingId = node.id
  }
  for (const key of STAT_KEYS) next.stats[key] = clampStat(key, next.stats[key])
  return next
}

export function applyChoice(content: Content, state: RunState, choiceId: string): RunState {
  if (state.closed || state.endingId) return state
  const choice = visibleChoices(content, state).find((item) => item.id === choiceId)
  if (!choice) return state
  let next = applyEffects(state, choice.effects)
  next.ap = Math.max(0, next.ap - (choice.cost ?? 0))
  if (choice.fx) next.pendingFx = choice.fx
  next = checkVital(next)
  if (next.endingId) return next
  return enterNode(content, next, choice.goto)
}

export function clearFx(state: RunState): RunState {
  if (!state.pendingFx) return state
  return { ...state, pendingFx: null }
}

export function stallRecover(content: Content, state: RunState): RunState {
  if (state.closed || state.endingId || state.ap > 0) return state
  if (visibleChoices(content, state).length > 0) return state
  const hurt = applyEffects(state, [{ op: 'stat.add', stat: 'body', delta: -5 }])
  return checkVital({ ...hurt, ap: 3 })
}
