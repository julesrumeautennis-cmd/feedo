import assert from 'node:assert/strict';
import test from 'node:test';
import { act, availableActions, createSession } from '../src/training/session.js';

function apply(state, ...ids) {
  return ids.reduce((current, id) => {
    assert.ok(availableActions(current).some(option => option.id === id), id + ' should be available in ' + current.stage);
    return act(current, id);
  }, state);
}
const finish = (s, v) => apply(s, 'photograph', 'inspect-' + v, 'isolate-' + v, 'repair', 'restore', 'verify');

for (const variant of ['A', 'B']) {
  test('completed case ' + variant + ' requires observation, repair and pressurized check', () => {
    const start = createSession({ variant });
    const original = structuredClone(start);
    assert.equal(act(start, 'repair'), start);
    assert.equal(act(start, 'verify'), start);
    const photo = apply(start, 'photograph');
    assert.equal(photo.assessment.firstCandidate, variant);
    assert.equal(photo.readings.length, 2);
    const isolated = apply(photo, 'inspect-' + variant, 'isolate-' + variant);
    assert.equal(isolated.leakActive, false);
    assert.equal(isolated.readings.find(r => r.branch === variant).flow, 0);
    assert.equal(act(isolated, 'verify'), isolated);
    const repaired = apply(isolated, 'repair');
    const blocked = apply(repaired, 'verify');
    assert.equal(blocked.stage, 'verify');
    assert.equal(blocked.metrics.prematureChecks, 1);
    assert.equal(blocked.isolated, variant);
    assert.equal(blocked.log.at(-1).agent, 'auditor');
    const complete = apply(blocked, 'restore', 'verify');
    assert.equal(complete.stage, 'complete');
    assert.equal(complete.result.diagnosisUnaided, true);
    assert.equal(complete.result.verifiedOnFirstTry, false);
    assert.deepEqual(complete.readings.map(r => r.flow), complete.readings.map(r => r.expected));
    assert.deepEqual(availableActions(complete), []);
    assert.deepEqual(start, original);
  });
}

test('the mentor adapts to a dry inspection and the auditor records later improvement', () => {
  const guided = apply(createSession(), 'photograph', 'inspect-B', 'hint');
  assert.equal(guided.metrics.wrongInspections, 1);
  assert.equal(guided.firstInspection, 'B');
  assert.equal(guided.metrics.hints, 1);
  assert.match(guided.coach, /A/);
  assert.equal(act(guided, 'inspect-B'), guided);
  assert.equal(act(guided, 'hint'), guided);
  const incorrectIsolation = apply(guided, 'inspect-A', 'isolate-B');
  assert.equal(incorrectIsolation.metrics.wrongIsolations, 1);
  assert.equal(incorrectIsolation.leakActive, true);
  assert.equal(act(incorrectIsolation, 'repair'), incorrectIsolation);
  const completed = apply(incorrectIsolation, 'isolate-A', 'repair', 'verify', 'restore', 'verify');
  const transfer = finish(createSession({ variant: 'B', previousResult: completed.result }), 'B');
  assert.equal(transfer.result.diagnosisUnaided, true);
  assert.equal(transfer.result.verifiedOnFirstTry, true);
  assert.equal(transfer.metrics.hints, 0);
  assert.match(transfer.result.comparison, /non → oui/);
});

test('an early restore or replay cannot create a completion', () => {
  const state = apply(createSession(), 'photograph');
  for (const id of ['restore', 'photograph', 'verify', 'repair', 'something_else']) assert.equal(act(state, id), state);
  assert.throws(() => createSession({ variant: 'C' }), RangeError);
  const replay = structuredClone(state);
  assert.deepEqual(finish(createSession(), 'A').result.metrics, { hints: 0, wrongInspections: 0, wrongIsolations: 0, prematureChecks: 0 });
  assert.deepEqual(replay, state);
});

test('history replays an identical session and resets for transfer', () => {
  const completed = apply(createSession(), 'photograph', 'inspect-B', 'hint', 'inspect-A',
    'isolate-A', 'repair', 'verify', 'restore', 'verify');
  const replay = completed.history.reduce(act, createSession());
  assert.deepEqual(replay, completed);
  const transfer = createSession({ variant: 'B', previousResult: completed.result });
  assert.deepEqual(transfer.history, []);
  assert.equal(transfer.stage, 'observe');
});
