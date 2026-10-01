import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkContent } from '../src/check/rules'
import { loadDisk } from './disk'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const forbidden = ['가문', '창표', '융합', '고유능력', '잠재능력', '이벤트 능력', '펫']

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function expectError(label: string, errors: string[], code: string) {
  if (!errors.some((error) => error.startsWith(code))) fail(`fixture ${label} missing ${code}\n${errors.join('\n')}`)
}

const content = loadDisk()
const report = checkContent(content)
if (report.errors.length > 0) fail(report.errors.join('\n'))
for (const warning of report.warnings) console.log(`warn ${warning}`)

const same = structuredClone(content)
const wake = same.nodes.D01_WAKE
if (!wake?.choices) fail('fixture wake')
wake.choices[1].label = wake.choices[0].label
expectError('same', checkContent(same).errors, 'same-choice')

const shelter = structuredClone(content)
shelter.nodes.D01_HUB.onEnter = [{ op: 'axis.set', key: 'voice_policy', value: 'cut' }]
expectError('shelter', checkContent(shelter).errors, 'shelter-axis')

const unread = structuredClone(content)
unread.flags = [...unread.flags, { id: 'ghost_flag', group: 'axis', type: 'bool', note: 'fixture' }]
const note = unread.nodes.D01_NOTE
if (!note?.choices) fail('fixture note')
note.choices[0].when = [{ op: 'axis.eq', key: 'ghost_flag', value: true }]
expectError('unread', checkContent(unread).errors, 'read-unwritten')

const dangling = structuredClone(content)
if (!dangling.nodes.D01_NOTE.choices) fail('fixture note')
dangling.nodes.D01_NOTE.choices[0].goto = 'NO_SUCH'
expectError('dangling', checkContent(dangling).errors, 'dangling-goto')

const orphan = structuredClone(content)
orphan.nodes.ORPHAN = { id: 'ORPHAN', text: '닿지 않는 방', choices: [] }
expectError('orphan', checkContent(orphan).errors, 'unreachable')

const encounter = structuredClone(content)
encounter.encounters.tunnel.cards[0].effects = [{ op: 'axis.set', key: 'voice_policy', value: 'cut' }]
expectError('encounter', checkContent(encounter).errors, 'encounter-axis')

const screenFiles = ['index.html', 'src/main.ts', 'src/view/app.css', 'src/view/labels.ts']
for (const file of screenFiles) {
  const text = readFileSync(path.join(root, file), 'utf8')
  for (const word of forbidden) {
    if (text.includes(word)) fail(`screen ${file} has ${word}`)
  }
}

console.log(`check ok nodes=${Object.keys(content.nodes).length} warnings=${report.warnings.length}`)
