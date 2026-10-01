import { loadBrowser } from './content/browser'
import { Stage } from './render/stage'
import { applyChoice, choiceLabel, clearFx, initialState, nodeText, stallRecover, visibleChoices } from './runtime/engine'
import { decodeSave, encodeSave, VERSION_REFUSE } from './runtime/save'
import { SAVE_KEY, type Content, type RunState } from './runtime/types'
import { itemLabel, STAT_LABEL } from './view/labels'
import './view/app.css'

const MOTION_KEY = 'jg.reduced'

const app = document.querySelector('#app')
if (!app) throw new Error('missing app')

const shell = document.createElement('div')
shell.className = 'shell'
shell.innerHTML = `
  <header>
    <div>
      <h1>진행형 게임</h1>
      <p id="day" class="day"></p>
    </div>
    <button id="motion" type="button">움직임 줄이기</button>
  </header>
  <div class="stage-wrap"><canvas id="stage" aria-hidden="true"></canvas></div>
  <div id="hud" class="hud"></div>
  <p id="lead" class="lead"></p>
  <p id="text" class="text"></p>
  <div id="choices" class="choices"></div>
`
app.append(shell)

const dayEl = shell.querySelector('#day') as HTMLElement
const motionBtn = shell.querySelector('#motion') as HTMLButtonElement
const canvas = shell.querySelector('#stage') as HTMLCanvasElement
const hudEl = shell.querySelector('#hud') as HTMLElement
const leadEl = shell.querySelector('#lead') as HTMLElement
const textEl = shell.querySelector('#text') as HTMLElement
const choicesEl = shell.querySelector('#choices') as HTMLElement
const stage = new Stage(canvas)

let content: Content
let state: RunState
const storedMotion = localStorage.getItem(MOTION_KEY)
let reduced = storedMotion === null
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : storedMotion === '1'

function freshSeed(): number {
  const seed = Date.now() & 0x7fffffff
  return seed || 1
}

function persist() {
  localStorage.setItem(SAVE_KEY, encodeSave(state))
}

function render() {
  const node = content.nodes[state.nodeId]
  const fx = state.pendingFx
  dayEl.textContent = `무음창 ${state.day}`
  motionBtn.setAttribute('aria-pressed', reduced ? 'true' : 'false')
  stage.setReduced(reduced)
  stage.setClips(
    node?.presentation?.ambient ? content.clips[node.presentation.ambient] ?? null : null,
    node?.presentation?.clip ? content.clips[node.presentation.clip] ?? null : null,
  )
  const stats = state.stats
  const bits: string[] = (Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[]).map((key) => {
    const klass = key === 'body' && stats.body < 40 ? 'danger' : key === 'memory' && stats.memory <= 30 ? 'memory' : ''
    return `<span class="${klass}"><b>${STAT_LABEL[key]}</b> ${stats[key]}</span>`
  })
  bits.push(`<span><b>행동점</b> ${state.ap}</span>`)
  hudEl.innerHTML = bits.join('')
  const site = document.createElement('p')
  site.className = 'site'
  site.textContent = `${node?.site ?? '여기'} · ${state.inventory.map(itemLabel).join(', ')}`
  hudEl.append(site)
  leadEl.textContent = state.lead
  leadEl.hidden = state.lead.length === 0
  textEl.dataset.node = state.nodeId
  textEl.dataset.ending = state.endingId ?? ''
  textEl.textContent = nodeText(content, state)
  choicesEl.replaceChildren()
  if (!state.closed) {
    const choices = visibleChoices(content, state)
    choices.forEach((choice, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'choice'
      button.dataset.choice = choice.id
      button.textContent = choiceLabel(choice.label, state, index, choices.length)
      button.addEventListener('click', () => {
        state = applyChoice(content, state, choice.id)
        persist()
        render()
      })
      choicesEl.append(button)
    })
    if (choices.length === 0) {
      const stall = document.createElement('button')
      stall.type = 'button'
      stall.className = 'choice'
      stall.dataset.choice = 'stall'
      stall.textContent = '무릎을 꿇고 다시 센다'
      stall.addEventListener('click', () => {
        state = stallRecover(content, state)
        persist()
        render()
      })
      choicesEl.append(stall)
    }
  } else {
    const again = document.createElement('button')
    again.type = 'button'
    again.className = 'restart'
    again.dataset.choice = 'restart'
    again.textContent = '다시 무음창을 연다'
    again.addEventListener('click', () => {
      state = initialState(freshSeed())
      persist()
      render()
    })
    choicesEl.append(again)
  }
  if (fx) {
    stage.trigger(fx)
    state = clearFx(state)
    persist()
  }
}

function showRefuse() {
  shell.hidden = true
  const panel = document.createElement('div')
  panel.className = 'shell refuse'
  panel.innerHTML = `<p class="text">${VERSION_REFUSE}</p>`
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'restart'
  button.textContent = '새 무음창을 연다'
  button.addEventListener('click', () => {
    panel.remove()
    shell.hidden = false
    state = initialState(freshSeed())
    persist()
    render()
  })
  panel.append(button)
  app?.append(panel)
}

motionBtn.addEventListener('click', () => {
  reduced = !reduced
  localStorage.setItem(MOTION_KEY, reduced ? '1' : '0')
  stage.setReduced(reduced)
  render()
})

async function boot() {
  content = await loadBrowser()
  const decoded = decodeSave(localStorage.getItem(SAVE_KEY))
  if (decoded.ok === false && decoded.reason === 'version') {
    showRefuse()
    stage.start()
    return
  }
  state = decoded.ok ? decoded.run : initialState(freshSeed())
  if (!decoded.ok) persist()
  stage.setReduced(reduced)
  stage.start()
  render()
}

void boot()
