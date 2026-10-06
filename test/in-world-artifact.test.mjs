import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('陶罐介绍属于漫游场景内弹窗，不再跳转到页面下方卡片',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const viewer=await readFile(new URL('../public/viewer-entry.js',import.meta.url),'utf8');
  assert.match(html,/id="artifactDialog"[^>]*role="dialog"/);
  assert.match(html,/id="artifactHotspot"/);
  assert.match(html,/id="ambientToggle"/);
  assert.doesNotMatch(html,/id="artifactPanel"/);
  assert.doesNotMatch(app,/artifactPanel.*scrollIntoView/);
  assert.match(viewer,/pick\.intersectObject\(pot,true\)/);
});
