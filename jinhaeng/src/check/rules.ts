import type { Cond, Content, Effect, Node } from '../runtime/types'

const CLIP_IDS = ['fog_idle', 'speaker_loop', 'tunnel_walk', 'tower_door']
const VITALS = ['END_BODY', 'END_MEMORY']
const START = 'D01_WAKE'

export type Report = { errors: string[]; warnings: string[] }

function effectsOf(node: Node): Effect[] {
  const bag: Effect[] = [...(node.onEnter ?? [])]
  for (const choice of node.choices ?? []) bag.push(...(choice.effects ?? []))
  return bag
}

function condsOf(node: Node): Cond[] {
  const bag: Cond[] = []
  if (Array.isArray(node.text)) {
    for (const variant of node.text) bag.push(...(variant.when ?? []))
  }
  for (const choice of node.choices ?? []) bag.push(...(choice.when ?? []))
  return bag
}

function frameLines(frame: string): string[] {
  return frame.replace(/\n$/, '').split('\n')
}

export function checkContent(content: Content): Report {
  const errors: string[] = []
  const warnings: string[] = []
  const nodes = content.nodes

  if (!nodes[START]) errors.push(`missing-start: ${START}`)

  const reads = new Set<string>()
  const writes = new Set<string>()
  const known = new Set(content.flags.map((flag) => flag.id))

  for (const node of Object.values(nodes)) {
    const labels = new Set<string>()
    const ids = new Set<string>()
    for (const choice of node.choices ?? []) {
      if (labels.has(choice.label)) errors.push(`same-choice: ${node.id} ${choice.label}`)
      labels.add(choice.label)
      if (ids.has(choice.id)) errors.push(`same-choice: ${node.id} #${choice.id}`)
      ids.add(choice.id)
      if (!nodes[choice.goto]) errors.push(`dangling-goto: ${node.id} ${choice.id} -> ${choice.goto}`)
      if ((node.id.startsWith('D02_') || node.id.startsWith('D03_')) && choice.goto.startsWith('D01_')) {
        errors.push(`day-regress: ${node.id} ${choice.id} -> ${choice.goto}`)
      }
    }
    for (const effect of effectsOf(node)) {
      if (effect.op === 'axis.set' || effect.op === 'color.set') {
        writes.add(effect.key)
        if (!known.has(effect.key)) errors.push(`unknown-flag: ${effect.key}`)
      }
    }
    if (node.shelter && node.onEnter?.some((effect) => effect.op === 'axis.set' || effect.op === 'color.set')) {
      errors.push(`shelter-axis: ${node.id} 쉼터 진입이 축을 고친다`)
    }
    for (const cond of condsOf(node)) {
      if (cond.op === 'axis.eq' || cond.op === 'color.eq') {
        reads.add(cond.key)
        if (!known.has(cond.key)) errors.push(`unknown-flag: ${cond.key}`)
      }
    }
    const clipId = node.presentation?.clip
    const ambientId = node.presentation?.ambient
    if (clipId && !content.clips[clipId]) errors.push(`missing-clip: ${node.id} ${clipId}`)
    if (ambientId && !content.clips[ambientId]) errors.push(`missing-clip: ${node.id} ${ambientId}`)
  }

  for (const deck of Object.values(content.encounters)) {
    for (const card of deck.cards) {
      for (const effect of card.effects ?? []) {
        if (effect.op === 'axis.set' || effect.op === 'color.set') {
          errors.push(`encounter-axis: ${deck.id} ${card.id}`)
        }
      }
    }
  }

  const seen = new Set<string>()
  const queue: string[] = []
  if (nodes[START]) {
    seen.add(START)
    queue.push(START)
  }
  while (queue.length > 0) {
    const id = queue.pop() as string
    const node = nodes[id]
    if (!node?.choices) continue
    for (const choice of node.choices) {
      if (!nodes[choice.goto] || seen.has(choice.goto)) continue
      seen.add(choice.goto)
      queue.push(choice.goto)
    }
  }
  for (const id of VITALS) {
    if (!nodes[id] || nodes[id].kind !== 'vital') errors.push(`missing-vital: ${id}`)
    else seen.add(id)
  }
  for (const id of Object.keys(nodes)) {
    if (!seen.has(id)) errors.push(`unreachable: ${id}`)
  }

  for (const flag of known) {
    if (reads.has(flag) && !writes.has(flag)) errors.push(`read-unwritten: ${flag}`)
    else if (writes.has(flag) && !reads.has(flag)) warnings.push(`dead-write: ${flag}`)
    else if (!reads.has(flag) && !writes.has(flag)) warnings.push(`unused-flag: ${flag}`)
  }

  const clipIds = Object.keys(content.clips).sort()
  const expected = [...CLIP_IDS].sort()
  if (clipIds.join(',') !== expected.join(',')) errors.push(`clip-count: ${clipIds.join(',')}`)
  for (const id of CLIP_IDS) {
    const clip = content.clips[id]
    if (!clip) continue
    if (clip.fps !== 12 || clip.loop !== true) errors.push(`clip-fps: ${id}`)
    if (clip.frames.length < 8) errors.push(`clip-frames: ${id}`)
    for (const frame of clip.frames) {
      const lines = frameLines(frame)
      if (lines.length !== 18) errors.push(`clip-size: ${id} rows ${lines.length}`)
      for (const line of lines) {
        if (line.length !== 72) errors.push(`clip-size: ${id} cols ${line.length}`)
        if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(line) || /[^\x20-\x7e]/.test(line)) errors.push(`clip-glyph: ${id}`)
      }
    }
  }

  return { errors, warnings }
}
