import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {riverWorldState,asset} from '../generation.mjs';

test('03 漫游只使用新的纯河岸世界，不再呈现 A/B 对比入口',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const viewer=await readFile(new URL('../public/viewer-entry.js',import.meta.url),'utf8');
  assert.match(html,/<span class="step">03<\/span><h3>漫游场景<\/h3>/);
  assert.doesNotMatch(html,/id="compareA"|id="compareB"|id="nearfieldToggle"/);
  assert.match(app,/api\/river-world\/status/);
  assert.match(app,/platformMode:true/);
  assert.doesNotMatch(app,/state\.comparisonMode/);
  assert.match(app,/metricScaleFactor:w\.metricScaleFactor/);
  assert.match(viewer,/world\.walkFloorAt=platformFloorAt/);
  const world=await riverWorldState();
  assert.equal(world.status,'ready');
  assert.equal(world.model,'marble-1.1-plus');
  assert.ok(world.metricScaleFactor>0);
  assert.ok(world.groundPlaneOffset!==null);
  assert.equal((await asset(world.splat.replace('/generated/','')))?.mime,'application/octet-stream');
  assert.equal((await asset(world.collider.replace('/generated/','')))?.mime,'model/gltf-binary');
  assert.equal((await asset('left-river-environment-v1.png'))?.mime,'image/png');
});
