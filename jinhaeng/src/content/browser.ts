import { CONTENT_FILES, parseContent } from './parse'
import type { Content } from '../runtime/types'

export async function loadBrowser(): Promise<Content> {
  const files = await Promise.all(
    CONTENT_FILES.map(async (name) => {
      const res = await fetch(`/content/${name}`)
      if (!res.ok) throw new Error(`missing content ${name}`)
      return { name, text: await res.text() }
    }),
  )
  return parseContent(files)
}
