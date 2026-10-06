// Scenes open in a layer above the map, so closing one leaves the map on the same chapter.
function strataCloseWalk() {
  const frame = document.getElementById('strataWalkFrame');
  if (!frame || frame.hidden) return;
  frame.hidden = true;
  document.body.classList.remove('strata-walk-open');
  setTimeout(() => { if (frame.hidden) frame.src = 'about:blank'; }, 400);
}
window.strataOpenWalk = function(url) {
  let frame = document.getElementById('strataWalkFrame');
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'strataWalkFrame';
    frame.title = 'Walk';
    frame.allow = 'autoplay; fullscreen';
    frame.hidden = true;
    document.body.appendChild(frame);
  }
  frame.src = url;
  frame.hidden = false;
  document.body.classList.add('strata-walk-open');
  frame.addEventListener('load', () => frame.contentWindow?.focus(), {once: true});
  frame.focus();
};
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.data !== 'strata-close-walk') return;
  strataCloseWalk();
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') strataCloseWalk();
});

// Warm the browser cache with scene files while the visitor reads the map.
window.addEventListener('load', () => {
  setTimeout(async () => {
    try {
      const list = await fetch('/linked/prefetch.json').then(response => response.json());
      for (const url of [...list.images, ...list.shoushan, ...list.zuojia]) {
        await fetch(url, {priority: 'low'}).then(response => response.arrayBuffer()).catch(() => {});
      }
    } catch { /* prefetch is optional */ }
  }, 1500);
});
