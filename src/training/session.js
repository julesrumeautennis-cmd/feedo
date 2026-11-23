import calibration from './calibration.json' with { type: 'json' };

const roster = [
  { id: 'scout', name: 'Alma', role: 'Repérage', decision: 'Je relève les écoulements dans la zone.' },
  { id: 'mentor', name: 'Noé', role: 'Accompagnement', decision: 'Choisissez comment vérifier la source.' },
  { id: 'auditor', name: 'Iris', role: 'Vérification', decision: 'Je demanderai une preuve après remise en eau.' },
];
const circuits = { A: 'A · bleu', B: 'B · orange' };
const action = (id, label) => ({ id, label });
const decimal = number => number.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function createSession({ variant = 'A', previousResult = null } = {}) {
  if (!Object.hasOwn(circuits, variant)) throw new RangeError('Le circuit doit être A ou B.');
  const coach = previousResult
    ? 'Nouvel incident. Faites votre diagnostic avec les relevés de ce cas.'
    : 'Une fuite est signalée. Documentez le point de chute pour ouvrir le dossier.';
  return {
    variant, previousResult, stage: 'observe', coach,
    leakActive: true, isolated: null, repaired: false, overlay: false,
    agents: roster.map(agent => ({ ...agent })),
    log: [{ agent: 'scout', reason: 'Écoulement observé. Les deux circuits traversent cette zone.' }],
    history: [], readings: [], assessment: null, evidence: [], inspected: [], firstInspection: null, result: null,
    metrics: { hints: 0, wrongInspections: 0, wrongIsolations: 0, prematureChecks: 0 },
  };
}

export function availableActions(state) {
  switch (state.stage) {
    case 'observe':
      return [action('photograph', 'Photographier la fuite')];
    case 'diagnose': {
      const choices = Object.keys(circuits).filter(id => !state.inspected.includes(id))
        .map(id => action('inspect-' + id, 'Inspecter ' + circuits[id]));
      if (!state.metrics.hints) choices.push(action('hint', 'Demander un indice'));
      return choices;
    }
    case 'repair':
      if (state.isolated === state.variant) return [action('repair', 'Remplacer le joint simulé')];
      return Object.keys(circuits).filter(id => state.isolated !== id)
        .map(id => action('isolate-' + id, 'Isoler ' + circuits[id]));
    case 'verify': {
      if (!state.isolated) return [action('verify', 'Tester le raccord en service')];
      const restore = action('restore', 'Remettre le circuit en eau');
      if (state.metrics.prematureChecks) return [restore];
      return [action('verify', 'Vérifier la réparation'), restore];
    }
    default:
      return [];
  }
}

function report(state, agentId, reason, coach = reason) {
  state.agents.find(agent => agent.id === agentId).decision = reason;
  state.log.push({ agent: agentId, reason });
  state.coach = coach;
}

function observe(state) {
  state.stage = 'diagnose';
  state.overlay = true;
  state.readings = calibration.cases[state.variant].map(row => ({ ...row, unit: 'L/min' }));
  const ranked = [...state.readings].sort((left, right) => rankReading(right) - rankReading(left));
  state.assessment = { firstCandidate: ranked[0].branch, source: 'feedo.observations', samplesPerBranch: 6 };
  state.evidence.push('Photo de la zone et relevés des deux sous-compteurs.');
  report(state, 'scout', 'La photo recoupe deux circuits. Le modèle a classé les relevés de pression et de débit. Je garde sa recommandation comme indice.',
    'Comparez le débit relevé à l’usage prévu, puis inspectez un raccord.');
}

function rankReading(row) {
  // The sigmoid is monotone. Its logit yields the same ranking.
  const { center, scale, weights } = calibration.model;
  const features = [row.flow - row.expected, row.pressureLoss];
  return features.reduce((logit, value, i) => logit + weights[i+1] * (value-center[i])/scale[i], weights[0]);
}

function offerHint(state) {
  const target = state.readings.find(row => row.branch === state.assessment.firstCandidate);
  const delta = decimal(target.flow - target.expected);
  state.metrics.hints++;
  report(state, 'scout', 'Le modèle classe le circuit ' + target.branch + ' en premier. Excédent de ' + delta + ' L/min et perte de pression de ' + decimal(target.pressureLoss) + ' kPa.');
  report(state, 'mentor', 'Alma soupçonne le circuit ' + target.branch + '. Vérifiez son raccord pour confirmer cette hypothèse.');
}

function inspect(state, circuit) {
  state.firstInspection ??= circuit;
  state.inspected.push(circuit);
  if (circuit !== state.variant) {
    state.metrics.wrongInspections++;
    state.evidence.push('Raccord ' + circuit + ' sec lors de l’inspection.');
    report(state, 'scout', 'Raccord ' + circuit + ' sec. Son débit correspond à un usage prévu.');
    report(state, 'mentor', 'Le débit total vous a orienté vers un raccord sec. Comparez maintenant les écarts entre relevé et usage.');
    return;
  }
  state.stage = 'repair';
  state.evidence.push('Gouttes observées au joint du circuit ' + circuit + '.');
  report(state, 'scout', 'Le joint ' + circuit + ' goutte à l’inspection. La photo et le relevé sont rattachés au même circuit.',
    'Choisissez le circuit à isoler dans la simulation.');
}

function isolate(state, circuit) {
  // A new choice brings the previously selected circuit back into service.
  state.isolated = circuit;
  state.leakActive = circuit !== state.variant;
  state.readings = calibration.cases[state.variant].map(row => ({
    ...row, flow: row.branch === circuit ? 0 : row.flow,
    pressureLoss: row.branch === circuit ? null : row.pressureLoss, unit: 'L/min',
  }));
  if (state.leakActive) {
    state.metrics.wrongIsolations++;
    report(state, 'mentor', 'Le circuit ' + circuit + ' est isolé et le raccord fuit toujours. Corrigez la sélection pour rétablir cet usage.');
    return;
  }
  report(state, 'scout', 'Le débit du circuit ' + circuit + ' est nul et le raccord cesse de goutter. Le joint peut être remplacé dans la simulation.');
}

function restore(state) {
  state.isolated = null;
  state.readings = state.readings.map(row => ({ ...row, flow: row.expected, pressureLoss: 0 }));
  report(state, 'scout', 'Circuit remis en eau. Les débits rejoignent les usages prévus.',
    'Observez le raccord sous pression et demandez le contrôle final.');
}

function summarize(state) {
  const metrics = { ...state.metrics };
  const diagnosisUnaided = !metrics.hints && !metrics.wrongInspections;
  const verifiedOnFirstTry = !metrics.prematureChecks;
  const feedback = [
    diagnosisUnaided
      ? 'Vous avez identifié le raccord ' + state.variant + ' au premier essai, sans indice.'
      : 'Diagnostic confirmé après ' + metrics.wrongInspections + ' inspection(s) à sec et ' + metrics.hints + ' indice(s).',
    metrics.wrongIsolations
      ? 'Un autre circuit a été isolé avant le bon. Identifiez le raccord avant la manœuvre.'
      : 'Seul le circuit de la fuite a été isolé.',
    verifiedOnFirstTry
      ? 'Vous avez rétabli la pression avant de vérifier le raccord.'
      : 'Une vérification a été demandée vanne fermée. Le dernier contrôle a été effectué en service.',
  ];
  let comparison = null;
  if (state.previousResult) {
    const before = state.previousResult;
    comparison = 'Diagnostic autonome : ' + (before.diagnosisUnaided ? 'oui' : 'non') + ' → ' +
      (diagnosisUnaided ? 'oui' : 'non') + '. Contrôle sous pression dès le premier essai : ' +
      (before.verifiedOnFirstTry ? 'oui' : 'non') + ' → ' + (verifiedOnFirstTry ? 'oui' : 'non') + '.';
  }
  return { variant: state.variant, firstInspection: state.firstInspection, diagnosisUnaided, verifiedOnFirstTry, metrics, feedback, comparison };
}

function verify(state) {
  if (state.isolated) {
    state.metrics.prematureChecks++;
    report(state, 'auditor', 'Vérification refusée. Le raccord est sec mais isolé. Le joint doit être éprouvé sous pression dans la simulation.');
    return;
  }
  state.stage = 'complete';
  state.evidence.push('Raccord sec après remise en eau, débit revenu à la valeur prévue.');
  state.result = summarize(state);
  report(state, 'auditor', 'Dossier validé. Le raccord ' + state.variant + ' est sec en service, avec le débit prévu. Les deux preuves concordent.');
}

export function act(state, actionId) {
  if (!availableActions(state).some(choice => choice.id === actionId)) return state;
  const next = structuredClone(state);
  next.history.push(actionId);
  if (actionId.startsWith('inspect-')) {
    inspect(next, actionId.slice(-1));
  } else if (actionId.startsWith('isolate-')) {
    isolate(next, actionId.slice(-1));
  } else {
    switch (actionId) {
      case 'photograph': observe(next); break;
      case 'hint': offerHint(next); break;
      case 'repair':
        next.repaired = true;
        next.stage = 'verify';
        next.evidence.push('Joint ' + next.variant + ' remplacé dans la simulation.');
        report(next, 'mentor', 'Le joint a été remplacé. Choisissez comment établir que la réparation tient.');
        break;
      case 'restore': restore(next); break;
      case 'verify': verify(next); break;
    }
  }
  return next;
}
