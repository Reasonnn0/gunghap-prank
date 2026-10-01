import { checkContent } from '../src/check/rules'
import { fxBudget } from '../src/render/budget'
import { applyChoice, choiceLabel, initialState, nodeText } from '../src/runtime/engine'
import { decodeSave, encodeSave, VERSION_REFUSE } from '../src/runtime/save'
import type { Content, RunState } from '../src/runtime/types'
import { loadDisk } from './disk'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function run(content: Content, steps: string[], seed = 1): RunState {
  let state = initialState(seed)
  for (const id of steps) {
    const before = state.nodeId
    state = applyChoice(content, state, id)
    if (state.nodeId === before && !state.endingId) {
      fail(`stuck ${id} at ${before} ap=${state.ap} day=${state.day}`)
    }
  }
  return state
}

const content = loadDisk()
if (checkContent(content).errors.length > 0) fail('content failed check')

const recordSteps = ['record', 'cont', 'tunnel', 'back', 'close', 'yard', 'lock', 'rope', 'back', 'close', 'enter', 'in', 'take']
const answerSteps = ['answer', 'say', 'tunnel', 'back', 'close', 'yard', 'lock', 'rope', 'back', 'close', 'enter', 'in', 'take']
const cutSteps = ['cut', 'cont', 'tunnel', 'back', 'close', 'yard', 'lock', 'rope', 'back', 'close', 'enter', 'in', 'take']
const lockSteps = ['cut', 'cont', 'tunnel', 'back', 'close', 'yard', 'lock', 'rope', 'back', 'close', 'enter', 'in', 'barricade']

const record = run(content, recordSteps)
const answer = run(content, answerSteps)
const cut = run(content, cutSteps)
const locked = run(content, lockSteps)
const recordText = nodeText(content, record)
const answerText = nodeText(content, answer)
const cutText = nodeText(content, cut)

if (record.nodeId !== 'D03_CHECKPOINT') fail(`record node ${record.nodeId}`)
if (answer.nodeId !== 'D03_CHECKPOINT') fail(`answer node ${answer.nodeId}`)
if (cut.nodeId !== 'D03_CHECKPOINT') fail(`cut node ${cut.nodeId}`)
if (!recordText.includes('녹음')) fail(recordText)
if (!answerText.includes('대답')) fail(answerText)
if (!cutText.includes('스피커')) fail(cutText)
if (new Set([recordText, answerText, cutText]).size !== 3) fail('checkpoint texts collapsed')

if (locked.endingId !== 'END_LOCKED') fail(`locked ${locked.endingId}`)
if (!nodeText(content, locked).includes('스피커')) fail(nodeText(content, locked))

const memory = run(content, ['cut', 'cont', 'listen', 'again'])
if (memory.endingId !== 'END_MEMORY') fail(`memory ${memory.endingId} mem=${memory.stats.memory}`)
const body = run(content, ['cut', 'cont', 'push', 'again'])
if (body.endingId !== 'END_BODY') fail(`body ${body.endingId} body=${body.stats.body}`)

const saved = decodeSave(encodeSave(body))
if (!saved.ok || saved.run.endingId !== 'END_BODY' || saved.run.nodeId !== 'END_BODY') fail('save roundtrip')
const mismatch = decodeSave(JSON.stringify({ version: 0, run: body }))
if (mismatch.ok || mismatch.reason !== 'version') fail('version mismatch')
if (!VERSION_REFUSE.includes('이전 무음창')) fail('refuse string')

const day2 = run(content, ['record', 'cont', 'close', 'listen', 'back'])
if (day2.nodeId !== 'D02_HUB' || day2.day !== 2) fail(`day regress ${day2.nodeId} day=${day2.day}`)

const withBiri = run(content, ['answer', 'say', 'close', 'biri', 'accept', 'back', 'close'])
if (withBiri.axis.companion !== 'biri' || withBiri.stats.water !== 0) {
  fail(`biri water ${withBiri.stats.water} companion=${String(withBiri.axis.companion)}`)
}

const quiet = fxBudget(true)
if (quiet.shakeCells !== 0 || quiet.flashMs !== 0 || !quiet.glitchColorOnly || quiet.frameMs !== 600) fail('reduced budget')
const reducedPath = run(content, recordSteps, 4)
if (reducedPath.nodeId !== 'D03_CHECKPOINT') fail('reduced path')
if (!nodeText(content, reducedPath).includes('녹음')) fail('reduced text')

const garbled = initialState(1)
garbled.stats.memory = 30
const plain = choiceLabel('귀를 막는다', garbled, 0, 2)
const last = choiceLabel('한 번 더', garbled, 1, 2)
if (plain !== '귀를 막는다' || !last.includes('▒')) fail(`garble ${plain} / ${last}`)

console.log('play ok', {
  record: recordText,
  answer: answerText,
  cut: cutText,
  locked: locked.endingId,
  memory: memory.endingId,
  body: body.endingId,
})
