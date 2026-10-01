import { SAVE_VERSION, type RunState } from './types'

export const VERSION_REFUSE = '이 저장은 이전 무음창의 기록이라 열 수 없다'

export type SaveEnvelope = { version: number; run: RunState }

export function encodeSave(run: RunState): string {
  const envelope: SaveEnvelope = { version: SAVE_VERSION, run }
  return JSON.stringify(envelope)
}

export function decodeSave(
  raw: string | null,
): { ok: true; run: RunState } | { ok: false; reason: 'empty' | 'version' | 'broken' } {
  if (!raw) return { ok: false, reason: 'empty' }
  let data: Partial<SaveEnvelope>
  try {
    data = JSON.parse(raw) as Partial<SaveEnvelope>
  } catch {
    return { ok: false, reason: 'broken' }
  }
  if (!data || typeof data.version !== 'number' || data.version !== SAVE_VERSION) {
    return { ok: false, reason: 'version' }
  }
  if (!data.run || typeof data.run.nodeId !== 'string') return { ok: false, reason: 'broken' }
  return { ok: true, run: data.run }
}
