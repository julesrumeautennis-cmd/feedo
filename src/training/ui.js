import { act, availableActions, createSession } from './session.js';

const stages = {
  observe: ['Observer la fuite', 1],
  diagnose: ['Identifier le circuit', 2],
  repair: ['Intervenir sur le raccord', 3],
  verify: ['Vérifier sous pression', 4],
  complete: ['Intervention terminée', 4],
};

const metrics = [
  ['hints', 'Indices demandés'],
  ['wrongInspections', 'Inspections hors cible'],
  ['wrongIsolations', 'Isolements hors cible'],
  ['prematureChecks', 'Contrôles prématurés'],
];

const byId = id => document.getElementById(id);
const actions = byId('actions');
const resultHistory = [];
let caseNumber = 1;
let capturedPhoto = null;
let state = createSession({ variant: 'A' });

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function openCase(number) {
  caseNumber = number;
  capturedPhoto = null;
  const firstResult = resultHistory[0];
  resultHistory.length = number - 1;
  state = createSession({
    variant: number === 1 ? 'A' : 'B',
    previousResult: number === 2 ? firstResult : undefined,
  });
  render();
  window.dispatchEvent(new CustomEvent('feedo:focus', { detail: { mode: 'overview' } }));
}

function pushState() {
  window.dispatchEvent(new CustomEvent('feedo:state', { detail: state }));
}

function actionButton(label, id, primary) {
  const button = element('button', null, primary ? 'action primary' : 'action');
  button.type = 'button';
  button.dataset.action = id;
  const arrow = element('span', '→', 'action-glyph');
  arrow.setAttribute('aria-hidden', 'true');
  button.append(element('span', label), arrow);
  return button;
}

function showActions() {
  if (state.stage === 'complete') {
    const next = caseNumber === 1 ? ['Commencer le deuxième cas', 'next-case'] : ['Reprendre la formation', 'first-case'];
    actions.replaceChildren(actionButton(...next, true));
    return;
  }
  const choices = availableActions(state);
  // The learner chooses between equally weighted actions when a decision is open.
  const decisions = choices.filter(({ id }) => id !== 'hint');
  actions.replaceChildren(...choices.map(({ id, label }) =>
    actionButton(label, id, decisions.length === 1 && decisions[0].id === id),
  ));
}

function showAgents() {
  byId('team-count').textContent = state.agents.length + ' agents';
  const rows = state.agents.map(agent => {
    const row = element('div', null, 'agent');
    const avatar = element('span', agent.name.slice(0, 1), 'avatar');
    avatar.classList.add(agent.id);
    avatar.setAttribute('aria-hidden', 'true');
    const content = element('div');
    const heading = element('div', null, 'agent-heading');
    heading.append(element('strong', agent.name), element('span', agent.role, 'agent-role'));
    content.append(heading, element('p', agent.decision, 'agent-decision'));
    row.append(avatar, content);
    return row;
  });
  byId('agents').replaceChildren(...rows);
}

function showLog() {
  const count = state.log.length;
  byId('log-count').textContent = count + (count > 1 ? ' décisions' : ' décision');
  const rows = [...state.log].reverse().map((entry, index) => {
    const agent = state.agents.find(person => person.id === entry.agent);
    const row = element('li', null, 'log-row');
    row.append(
      element('span', String(count - index).padStart(2, '0'), 'log-index'),
      element('span', agent?.name ?? entry.agent, 'log-who'),
      element('span', entry.reason, 'log-reason'),
    );
    return row;
  });
  if (!rows.length) rows.push(element('li', 'Les décisions apparaîtront à la première observation.', 'empty'));
  byId('log').replaceChildren(...rows);
}

function makeTable(headers, rows) {
  const table = element('table');
  const head = table.createTHead().insertRow();
  for (const title of headers) {
    const th = element('th', title);
    th.scope = 'col';
    head.append(th);
  }
  const body = table.createTBody();
  for (const cells of rows) {
    const row = body.insertRow();
    for (const [index, value] of cells.entries()) {
      const cell = index === 0 ? element('th', value) : element('td', value, 'number');
      if (index === 0) cell.scope = 'row';
      row.append(cell);
    }
  }
  return table;
}

function showEvidence() {
  const readings = state.readings ?? [];
  const evidence = state.evidence ?? [];
  byId('measurements').hidden = !evidence.length;
  byId('evidence-photo').hidden = !capturedPhoto;
  const photo = byId('captured-photo');
  if (capturedPhoto && photo.getAttribute('src') !== capturedPhoto) photo.src = capturedPhoto;
  if (!capturedPhoto) photo.removeAttribute('src');
  byId('readings-block').hidden = !readings.length || state.stage === 'complete';
  byId('evidence').replaceChildren(...evidence.map(text => element('li', text)));
  const numbers = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  const readingsTable = readings.length ? makeTable(
    ['Circuit', 'Mesuré', 'Attendu'],
    readings.map(({ branch, flow, expected }) => [branch, numbers.format(flow), numbers.format(expected)]),
  ) : null;
  byId('readings').replaceChildren(...(readingsTable ? [readingsTable] : []));
}

function showResult() {
  const result = state.result;
  byId('results').hidden = state.stage !== 'complete' || !result;
  if (byId('results').hidden) return;
  resultHistory[caseNumber - 1] = result;
  const rows = metrics.map(([key, title]) => [title, ...resultHistory.map(item => String(item.metrics[key]))]);
  const summary = byId('summary');
  summary.replaceChildren(makeTable(['Indicateur', ...resultHistory.map((_, i) => 'Cas ' + (i + 1))], rows));
  for (const note of result.feedback) summary.append(element('p', note, 'result-detail'));
  if (result.comparison) summary.append(element('p', result.comparison, 'result-detail'));
}

function render() {
  const [title, step] = stages[state.stage];
  byId('stage-title').textContent = title;
  byId('stage-number').textContent = state.stage === 'complete' ? 'Bilan' : 'Étape ' + String(step).padStart(2, '0') + ' / 04';
  byId('case-count').textContent = 'Cas 0' + caseNumber + ' / 02';
  Array.from(byId('step-bars').children).forEach((bar, index) => bar.classList.toggle('on', index < step));
  byId('coach').textContent = state.coach;
  byId('scene-key').hidden = !state.overlay;
  showActions();
  showAgents();
  showLog();
  showEvidence();
  showResult();
  pushState();
}

actions.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.action;
  if (id === 'next-case') openCase(2);
  else if (id === 'first-case') openCase(1);
  else {
    if (id === 'photograph') {
      window.dispatchEvent(new Event('feedo:photograph'));
      if (!capturedPhoto) {
        byId('coach').textContent = byId('status').hidden
          ? 'La photo n’a pas été enregistrée. Reprenez le constat dans la vue 3D.'
          : 'La vue 3D doit être chargée pour photographier la fuite.';
        return;
      }
    }
    state = act(state, id);
    render();
  }
  actions.querySelector('button')?.focus({ preventScroll: true });
});

byId('restart').addEventListener('click', () => openCase(caseNumber));
byId('focus-leak').addEventListener('click', () => {
  window.dispatchEvent(new CustomEvent('feedo:focus'));
  byId('view').focus({ preventScroll: true });
});
byId('stations').addEventListener('click', event => {
  if (event.target.closest('button')) event.currentTarget.closest('details').open = false;
});
window.addEventListener('feedo:photo-ready', event => {
  if (state.stage === 'observe' && event.detail?.url?.startsWith('data:image/jpeg;base64,')) {
    capturedPhoto = event.detail.url;
  }
});
window.addEventListener('feedo:scene-ready', () => {
  byId('coach').textContent = state.coach;
  pushState();
});
render();
