import test from 'node:test';
import assert from 'node:assert/strict';
import {sources} from '../data/catalog.mjs';
import {reconstruction} from '../data/reconstruction.mjs';

test('左家山生成证据有来源，且不混入二期石龙',()=>{
  const known=new Set(sources.map(x=>x.id));
  assert.equal(reconstruction.siteId,'left');
  assert.match(reconstruction.phase,/一期/);
  for(const item of reconstruction.evidence)assert.ok(known.has(item.source));
  for(const id of reconstruction.object.sourceIds)assert.ok(known.has(id));
  assert.doesNotMatch(reconstruction.world.prompt,/stone dragon|石龙/i);
  assert.doesNotMatch(reconstruction.object.prompt,/stone dragon|石龙/i);
  assert.equal(reconstruction.imageWorld.model,'marble-1.1');
  assert.match(reconstruction.imageWorld.conceptImage,/left-phase1-concept-v2\.png$/);
  assert.doesNotMatch(reconstruction.imageWorld.prompt,/stone dragon|石龙/i);
  assert.match(reconstruction.imageWorld.prompt,/hypothetical/i);
  assert.equal(reconstruction.plusWorld.model,'marble-1.1-plus');
  assert.equal(reconstruction.plusWorld.conceptImage,reconstruction.imageWorld.conceptImage);
  assert.equal(reconstruction.plusWorld.comparisonBaseline,'imageWorld');
  assert.ok(reconstruction.visualUnknowns.length>=3);
});
