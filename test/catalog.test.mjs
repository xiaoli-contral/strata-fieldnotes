import test from 'node:test';import assert from 'node:assert/strict';
import {sites,sources,candidates,nearby,distanceKm} from '../data/catalog.mjs';
test('所有事实和推断均可回到已登记来源',()=>{let ids=new Set(sources.map(s=>s.id));for(let s of sites)for(let c of s.claims){if(c.level!=='U')assert.ok(c.sources.length>0);for(let id of c.sources)assert.ok(ids.has(id));}});
test('无匹配不杜撰，OCR 空格归一化，同名九台明确候选',()=>{assert.deepEqual(candidates('恐龙和未来城市'),[]);assert.equal(candidates('左 家 山遗址')[0].id,'left');assert.equal(candidates('九台腰岭子')[0].id,'yaolingzi');});
test('距离包含定位误差且不把区域点写成遗址精确坐标',()=>{assert.equal(distanceKm({lat:0,lon:0},{lat:0,lon:0}),0);const rows=nearby(44.43,125.18,1000);assert.equal(rows[0].minKm,0);assert.equal(rows[0].maxKm,16);assert.match(rows[0].precision,/非遗址坐标/);assert.throws(()=>nearby(100,125));assert.throws(()=>nearby(NaN,125));});
