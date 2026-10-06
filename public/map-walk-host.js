function strataCloseWalk(){
  const frame=document.getElementById('strataWalkFrame');
  if(!frame||frame.hidden)return;
  frame.hidden=true;
  document.body.classList.remove('strata-walk-open');
  setTimeout(()=>{if(frame.hidden)frame.src='about:blank';},400);
}
window.strataOpenWalk=function(url){
  let frame=document.getElementById('strataWalkFrame');
  if(!frame){
    frame=document.createElement('iframe');
    frame.id='strataWalkFrame';
    frame.title='漫游场景';
    frame.hidden=true;
    document.body.appendChild(frame);
  }
  frame.src=url;
  frame.hidden=false;
  document.body.classList.add('strata-walk-open');
};
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data!=='strata-close-walk')return;
  strataCloseWalk();
});
