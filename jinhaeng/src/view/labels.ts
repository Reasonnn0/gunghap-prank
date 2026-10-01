import type { Stats } from '../runtime/types'

export const STAT_LABEL: Record<keyof Stats, string> = {
  body: '몸',
  memory: '기억',
  food: '식량',
  water: '식수',
  cell: '전지',
}

export const ITEM_LABEL: Record<string, string> = {
  lamp: '손전등',
  memo: '메모',
  rope: '로프',
  tape: '테이프',
}

export function itemLabel(id: string): string {
  return ITEM_LABEL[id] ?? id
}
