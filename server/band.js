const base = 'https://app.band.ai/api/v1';

export async function band(key, path, body, fetcher = fetch) {
  const response = await fetcher(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('BAND HTTP ' + response.status);
  return (await response.json()).data;
}

export function bandConfig(env) {
  const roles = {};
  for (const role of ['scout', 'mentor', 'auditor']) {
    const key = env['BAND_' + role.toUpperCase() + '_KEY'];
    const id = env['BAND_' + role.toUpperCase() + '_ID'];
    if (!key || !id) return null;
    roles[role] = { key, id };
  }
  return env.BAND_CHAT_ID ? { room: env.BAND_CHAT_ID, roles } : null;
}

async function exchange(config, from, to, content, request) {
  const path = '/agent/chats/' + encodeURIComponent(config.room) + '/messages';
  const sender = config.roles[from];
  const recipient = config.roles[to];
  const sent = await request(sender.key, path, { message: {
    content: '@' + to + ' ' + content, mentions: [{ id: recipient.id, name: to }],
  } });
  if (!sent?.success || !sent.recipients?.some(peer => peer.id === recipient.id)) {
    throw new Error('BAND n’a pas confirmé le destinataire');
  }
  // Read as the recipient and match the receipt. A send alone does not prove delivery.
  for (const delay of [0, 200, 550]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    const inbox = await request(recipient.key, path + '?sort_order=desc&limit=50');
    const received = inbox.find(msg => msg.id === sent.id && msg.sender_id === sender.id);
    if (received) return { id: sent.id, content: received.content };
  }
  throw new Error('BAND n’a pas confirmé la lecture');
}

export async function runHandoff(config, state, request = band) {
  const [first, second] = state.readings;
  if (!first || !second) throw new Error('Relevés indisponibles');
  const observation = { variant: state.variant, stage: state.stage, isolated: state.isolated,
    repaired: state.repaired, readings: state.readings.map(({ branch, flow, expected }) => ({ branch, flow, expected })) };
  const observed = await exchange(config, 'scout', 'mentor', JSON.stringify(observation), request);
  const packet = JSON.parse(observed.content.slice(observed.content.indexOf('{')));
  const anomaly = [...packet.readings].sort((a, b) => (b.flow - b.expected) - (a.flow - a.expected))[0];
  const finding = { stage: packet.stage, isolated: packet.isolated, repaired: packet.repaired,
    branchToInspect: anomaly.branch, residual: +(anomaly.flow - anomaly.expected).toFixed(2) };
  const handoff = await exchange(config, 'mentor', 'auditor', JSON.stringify(finding), request);
  const review = JSON.parse(handoff.content.slice(handoff.content.indexOf('{')));
  let verdict;
  if (review.isolated) verdict = 'Contrôle ajourné. Le circuit est isolé, le débit ne prouve pas la réparation sous pression.';
  else if (review.repaired && ['verify', 'complete'].includes(review.stage)) {
    verdict = 'Circuit remis en service. ' + (review.stage === 'complete' ? 'Le contrôle final a été consigné.' : 'Effectue le contrôle final au raccord.');
  } else verdict = 'Inspection recommandée sur le circuit ' + review.branchToInspect + '. Écart au débit attendu : ' + review.residual + ' L/min.';
  const checked = await exchange(config, 'auditor', 'scout', verdict, request);
  return { verdict, receipts: [observed.id, handoff.id, checked.id] };
}
