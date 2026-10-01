import { parse } from 'yaml'
import type { Clip, Content, EncounterDeck, FlagDef, Node } from '../runtime/types'

type FileText = { name: string; text: string }

export function parseContent(files: FileText[]): Content {
  const nodes: Record<string, Node> = {}
  const encounters: Record<string, EncounterDeck> = {}
  const clips: Record<string, Clip> = {}
  let flags: FlagDef[] = []
  for (const file of files) {
    const data = parse(file.text) as unknown
    const name = file.name.replace(/\\/g, '/')
    if (name.includes('graph/')) {
      const doc = data as { nodes: Node[] }
      for (const node of doc.nodes) nodes[node.id] = node
    } else if (name.includes('encounters/')) {
      const deck = data as EncounterDeck
      encounters[deck.id] = deck
    } else if (name.includes('clips/')) {
      const clip = data as Clip
      clips[clip.id] = clip
    } else if (name.endsWith('flags.yaml')) {
      flags = (data as { flags: FlagDef[] }).flags
    }
  }
  return { nodes, encounters, clips, flags }
}

export const CONTENT_FILES = [
  'flags.yaml',
  'graph/slice.yaml',
  'encounters/tunnel.yaml',
  'clips/fog_idle.yaml',
  'clips/speaker_loop.yaml',
  'clips/tunnel_walk.yaml',
  'clips/tower_door.yaml',
]
