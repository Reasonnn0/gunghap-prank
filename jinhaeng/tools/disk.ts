import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTENT_FILES, parseContent } from '../src/content/parse'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content')

export function loadDisk() {
  const files = CONTENT_FILES.map((name) => ({
    name,
    text: readFileSync(path.join(root, name), 'utf8'),
  }))
  return parseContent(files)
}
