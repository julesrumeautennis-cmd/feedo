import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, act } from '../src/training/session.js';
import { sponsorRequest } from '../server/providers.js';
import { runHandoff } from '../server/band.js';
import { readReference, sourceUrl } from '../server/reference.js';

test('les comptes absents sont identifiés et une preuve forgée est refusée', async () => {
  assert.deepEqual(await sponsorRequest({task:'status'},{}), {telem:false,band:false});
  assert.equal((await sponsorRequest({task:'reference'},{})).status,'unconfigured');
  await assert.rejects(sponsorRequest({task:'handoff',variant:'A',history:['verify']},{}),RangeError);
});
test('le verdict ne passe par BAND que si chaque destinataire relit le message attendu', async () => {
  const roles = Object.fromEntries(['scout','mentor','auditor'].map(id=>[id,{id,key:id}]));
  const config = {roles,room:'test-room'};
  const inbox = new Map();
  const request = async (key,path,body) => {
    if (!body) return inbox.get(key);
    const receiver = body.message.mentions[0].id;
    const id = key+'-'+receiver;
    inbox.set(receiver,[{id,content:body.message.content,sender_id:key}]);
    return {id, success:true, recipients:[{id:receiver}]};
  };
  const closed = ['photograph','inspect-A','isolate-A','repair','verify'].reduce(act,createSession());
  const result = await runHandoff(config,closed,request);
  assert.match(result.verdict,/isolé/);
  assert.equal(result.receipts.length,3);
  await assert.rejects(runHandoff(config,closed,async()=>({success:false})),/destinataire/);
});
test('la note du mentor exige une page confirmant réellement le test de lecture', async () => {
  const row = content => ({fetch: async()=>({interactionId:'trace',results:[{url:sourceUrl,content}]})});
  await assert.rejects(readReference('fake',row('No reference to the observation.')),/indice/);
  assert.equal((await readReference('fake',row('Read the meter when no water is being used. If the reading has changed, check for a leak.'))).trace,'trace');
});
