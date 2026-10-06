// Reproducible adaptation of the archived published build; upstream remains intact.
// Refuse changed upstream text instead of silently patching a different release.
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
const source=new URL('../vendor/map-v06b/',import.meta.url),dest=new URL('../public/v06b/',import.meta.url);
await mkdir(dest,{recursive:true});await cp(source,dest,{recursive:true});
const target=new URL('assets/map-Bz2mJyq1.js',dest);
let code=await readFile(target,'utf8');
function once(before,after){if(code.split(before).length!==2)throw Error('v06b integration anchor mismatch: '+before.slice(0,70));code=code.replace(before,after);}
once('function Zf(){const[c,o]=m.useState(0),[s,f]=m.useState(null)', 'function Zf(){const[c,o]=m.useState(()=>mapResume()?1:0),[s,f]=m.useState(()=>mapResume()?"1-2":null)');
const begin=code.indexOf('function s5(){'),end=code.indexOf('function S6(',begin);
if(begin<0||end<=begin)throw Error('Missing chapter completion function');
code=code.slice(0,begin)+'function s5(){if(!c4||h4.length<3||B)return;const next=c+1;F(G=>{const unlocked=new Set(G.unlocked);if(next<j1.length)unlocked.add(next);return {...G,complete:{...G.complete,[c4]:true},unlocked:[...unlocked]};});Y(null);l4(null);W(null);}'+code.slice(end);
once('children:[D.jsx("span",{children:B?"本章已完成"', 'children:[sceneActions(D,c4,B,c<j1.length-1?()=>T2(c+1):null),D.jsx("span",{children:B?"本章已完成"');
// Both comments refer to the same top-left wordmark link. Remove the element
// itself so neither the name nor its return action remains in the header.
once('D.jsx("a",{className:"wordmark",href:"../index.html",title:"返回开场",children:"吉林"})','null');
once('children:K.place})]}),n4&&','children:K.place}),O&&D.jsx("button",{onClick:()=>{Y(null);l4(null)},children:"返回观察全貌"})]}),n4&&');
code='import {sceneActions,mapResume} from "/map-scene-bridge.js";\n'+code;
await writeFile(target,code);
const plate=new URL('assets/AiPlateScene-BxO_G0g0.js',dest);
const badge=',l.jsx("span",{className:"ai-badge",children:"AI 画面示意 · 拖动是平移"})';
let plateCode=await readFile(plate,'utf8');
if(!plateCode.includes(badge))throw Error('AI hint badge anchor missing');
await writeFile(plate,plateCode.replace(badge,''));
const html=new URL('map/index.html',dest);
await writeFile(html,(await readFile(html,'utf8')).replace('</head>','<link rel="stylesheet" href="/map-scene-bridge.css">\n<script src="/map-walk-host.js"></script>\n</head>'));
console.log('v06b copied; chapter completion keeps the visitor in place with optional world / next chapter actions.');
