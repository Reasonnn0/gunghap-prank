import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'

const W = 72
const H = 18
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../content/clips')

function blank() {
  return Array.from({ length: H }, () => ' '.repeat(W))
}

function put(rows, y, x, text) {
  if (y < 0 || y >= H || !text) return
  const row = rows[y].split('')
  for (let i = 0; i < text.length; i += 1) {
    const xx = x + i
    if (xx < 0 || xx >= W) continue
    if (text[i] !== ' ') row[xx] = text[i]
  }
  rows[y] = row.join('')
}

function fogFrame(tick) {
  const rows = []
  for (let y = 0; y < H; y += 1) {
    let line = ''
    for (let x = 0; x < W; x += 1) {
      const n = Math.sin(x * 0.31 + tick * 0.7) + Math.sin(y * 0.55 + tick * 0.35)
      if (n > 1.15) line += '~'
      else if (n > 0.4) line += '.'
      else if (n < -1.25) line += ':'
      else line += ' '
    }
    rows.push(line)
  }
  return rows
}

function speakerFrame(tick) {
  const rows = blank()
  const pulse = tick % 8
  const mark = pulse < 4 ? '|' : ':'
  put(rows, 3, 16, `+${'-'.repeat(38)}+`)
  for (let y = 4; y <= 10; y += 1) {
    put(rows, y, 16, '|')
    put(rows, y, 55, '|')
  }
  put(rows, 11, 16, `+${'-'.repeat(38)}+`)
  const step = pulse > 5 ? 4 : 3
  for (let y = 5; y <= 9; y += 1) {
    let grille = ''
    for (let i = 0; i < 36; i += 1) grille += i % step === 0 ? mark : ' '
    put(rows, y, 18, grille)
  }
  put(rows, 12, 34, '|')
  put(rows, 13, 33, '/ \\')
  put(rows, 14, 30, '+------+')
  const wave = pulse % 2 === 0 ? ')))' : ') )'
  const back = pulse % 2 === 0 ? '(((' : '( ('
  put(rows, 7, 58, wave)
  put(rows, 6, 10, back)
  put(rows, 8, 10, back)
  return rows
}

function tunnelFrame(tick) {
  const rows = blank()
  for (let y = 0; y < H; y += 1) {
    const depth = Math.abs(y - 8)
    const inset = Math.max(1, Math.min(24, 2 + Math.floor((8 - depth) * 1.4) + (tick % 3 === 0 && y % 2 === 0 ? 1 : 0)))
    const chars = rows[y].split('')
    chars[inset] = '|'
    chars[W - 1 - inset] = '|'
    if (y >= 15) {
      for (let x = inset + 1; x < W - 1 - inset; x += 1) {
        if ((x + tick * 2) % 7 === 0) chars[x] = '-'
        else if ((x + y + tick) % 11 === 0) chars[x] = '.'
      }
    }
    rows[y] = chars.join('')
  }
  put(rows, 7, 34, '[ ]')
  put(rows, 8, 34, '[ ]')
  put(rows, 9, 34, '[=]')
  return rows
}

function towerFrame(tick) {
  const rows = blank()
  put(rows, 16, 0, '='.repeat(W))
  const lamp = tick % 2 === 0 ? '*' : '.'
  put(rows, 2, 30, `___${lamp}___`)
  for (let y = 3; y <= 15; y += 1) {
    put(rows, y, 28, '|')
    put(rows, y, 43, '|')
  }
  put(rows, 9, 32, '+------+')
  const door = tick % 8 > 5 ? '|    |' : '|####|'
  for (let y = 10; y <= 15; y += 1) put(rows, y, 33, door)
  put(rows, 5, 30, 'o')
  put(rows, 5, 41, 'o')
  put(rows, 8, 30, 'o')
  put(rows, 8, 41, 'o')
  if (tick % 4 === 0) put(rows, 6, 48, '~')
  if (tick % 4 === 2) put(rows, 7, 50, '.')
  return rows
}

function solidify(rows) {
  return rows.map((line, index) => {
    if (line.trim().length > 0) return line
    const chars = line.split('')
    chars[index % W] = '.'
    return chars.join('')
  })
}

function assertFrame(id, rows) {
  if (rows.length !== H) throw new Error(`${id} rows ${rows.length}`)
  for (const line of rows) {
    if (line.length !== W) throw new Error(`${id} width ${line.length}`)
    if (/[^\x20-\x7e]/.test(line)) throw new Error(`${id} non-ascii`)
  }
}

function emit(id, frames) {
  const safe = frames.map((frame) => solidify(frame))
  safe.forEach((frame) => assertFrame(id, frame))
  const yaml = stringify(
    { id, fps: 12, loop: true, frames: safe.map((frame) => frame.join('\n')) },
    { defaultStringType: 'QUOTE_DOUBLE', lineWidth: 0 },
  )
  writeFileSync(path.join(root, `${id}.yaml`), yaml)
}

mkdirSync(root, { recursive: true })
emit('fog_idle', Array.from({ length: 12 }, (_, i) => fogFrame(i)))
emit('speaker_loop', Array.from({ length: 8 }, (_, i) => speakerFrame(i)))
emit('tunnel_walk', Array.from({ length: 8 }, (_, i) => tunnelFrame(i)))
emit('tower_door', Array.from({ length: 8 }, (_, i) => towerFrame(i)))
console.log('clips written')
