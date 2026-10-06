// Map chapter ids are the published v06b ids. A world is enabled only after
// that exact chapter is completed and its own assets have been assembled.
export const sceneEntries={
  '0-2':{name:'寿山仙人洞',ready:false},
  '1-2':{name:'左家山一期生活场景',ready:true,url:'/?scene=zuojiashan-phase1&from=map-v06b#journey'},
  '2-0':{name:'兴城二期',ready:false},
  '3-0':{name:'后太平',ready:false}
};
export function mapResume(){
  try{return new URLSearchParams(location.search).get('resume')==='left'&&JSON.parse(localStorage.getItem('jilin-v05b-direct'))?.complete?.['1-2']===true;}catch{return false;}
}
export function sceneActions(jsx,id,complete,next){
  if(!complete||!sceneEntries[id])return null;
  const scene=sceneEntries[id];
  return jsx.jsxs('div',{className:'strata-scene-actions',children:[
    scene.ready?jsx.jsx('a',{className:'strata-world-link',href:scene.url,onClick:event=>{if(typeof window.strataOpenWalk==='function'){event.preventDefault();window.strataOpenWalk(scene.url);}},children:'进入'+scene.name+' →'}):jsx.jsx('span',{className:'strata-world-pending',children:scene.name+' · 3D 漫游筹备中'}),
    scene.ready?jsx.jsx('small',{children:'一期后段的房前生活。二期石龙保留在地图资料中。'}):jsx.jsx('small',{children:'本章观察已完成，后续将按当地资料制作可漫游场景。'}),
    next?jsx.jsx('button',{type:'button',onClick:next,children:'继续下一章 →'}):jsx.jsx('span',{children:'四个篇章已完成，可从上方回访。'})
  ]});
}
