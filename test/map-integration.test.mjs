import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {sceneActions,sceneEntries} from '../public/map-scene-bridge.js';
const jsx={jsx:(type,props)=>({type,...props}),jsxs:(type,props)=>({type,...props})};

test('四章只有已完成的左家山可进入已有世界，其余章不会误跳左家山',()=>{
  for(const id of Object.keys(sceneEntries)){
    assert.equal(sceneActions(jsx,id,false,()=>{}),null);
    const actions=sceneActions(jsx,id,true,()=>{});
    const links=actions.children.filter(x=>x?.type==='a');
    assert.equal(links.length,id==='1-2'?1:0);
    if(links.length)assert.equal(links[0].href,'/?scene=zuojiashan-phase1&from=map-v06b#journey');
  }
});

test('实际地图完成函数须观察三处才解锁下一章，完成后留在原章供选择',async()=>{
  const code=await readFile(new URL('../public/v06b/assets/map-Bz2mJyq1.js',import.meta.url),'utf8');
  const begin=code.indexOf('function s5(){');
  const fn=code.slice(begin,code.indexOf('function S6(',begin));
  for(const count of [0,2,3]){
    let saved={unlocked:[0,1],visited:[0,1],complete:{}};
    const scope={c4:'1-2',h4:Array(count).fill('seen'),B:false,c:1,j1:Array(4),F:update=>{saved=update(saved);},Y(){},l4(){},W(){}};
    runInNewContext(fn+';s5()',scope);
    assert.equal(Boolean(saved.complete['1-2']),count===3);
    assert.equal(saved.unlocked.includes(2),count===3);
    assert.equal(saved.visited.includes(2),false,'解锁不能冒充已访问');
  }
});

test('原地图文件完整留存，派生版本保留四个场景及一期专用返回入口',async()=>{
  const original=await readFile(new URL('../vendor/map-v06b/assets/map-Bz2mJyq1.js',import.meta.url),'utf8');
  assert.ok(!original.includes('sceneActions(D,'));
  for(const name of ['寿山仙人洞','左家山','兴城二期','后太平'])assert.ok(original.includes(name));
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const page=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(app.includes('/v06b/map/index.html?resume=left'));
  assert.ok(app.includes("location.assign('/v06b/map/index.html?resume=left')"));
  assert.ok(page.includes('src="/map-walk-boot.js"'));
  const boot=await readFile(new URL('../public/map-walk-boot.js',import.meta.url),'utf8');
  assert.ok(boot.includes("document.documentElement.classList.add('map-walk')"));
  assert.ok(page.includes('id="mapWalk"'));
  assert.equal(app.includes('返回新石器时代地图'),false);
});
