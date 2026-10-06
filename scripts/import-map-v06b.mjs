// Archive only the public files explicitly referenced by the supplied v06b page.
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base='https://legislature-menus-marijuana-hazardous.trycloudflare.com/v06b/';
const root=new URL('../vendor/map-v06b/',import.meta.url);
const files=['map/index.html','favicon.svg',...['map-Bz2mJyq1.js','map-CVYB87qP.css','modulepreload-polyfill-B5Qt9EMX.js','CaveScene-D-fK-yaT.js','AiPlateScene-BxO_G0g0.js','ZuojiaScene-DwCueqyE.js','XingchengScene-DGJvW7Ud.js','HoutaipingScene-Ca851Bfh.js'].map(x=>'assets/'+x)];
for(const [folder,names] of Object.entries({'cave-ai':['overview','mouth','tools','bones'],'zuojia-ai':['overview','dwell','dragon','pots'],'xing-ai':['overview','houses','house','wares'],'hou-ai':['overview','stone','pots','bronze']}))for(const name of names)files.push(`${folder}/${name}.png`);
const manifest=[];
for(const file of files){
  const response=await fetch(new URL(file,base),{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`${file}: ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  const target=new URL(file,root);await mkdir(new URL('.',target),{recursive:true});await writeFile(target,bytes);
  manifest.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});console.log(file,bytes.length);
}
await writeFile(new URL('manifest.json',root),JSON.stringify({source:base,retrievedAt:new Date().toISOString(),files:manifest},null,2)+'\n');
