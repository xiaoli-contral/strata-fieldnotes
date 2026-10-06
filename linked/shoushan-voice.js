const lang = document.documentElement.dataset.strataLang === "en" ? "en" : "zh";
const audio = new Audio();
let playing = "";
function source(id) {
  return lang === "en" ? `/api/linked-speech/shoushan/${id}?lang=en` : `/scenes/shoushan/speech/${id}.mp3`;
}
function play(id, force) {
  if (!id) return;
  if (!force && playing === id && !audio.paused) return;
  playing = id;
  audio.src = source(id);
  audio.play().catch(() => {});
}
function sync() {
  const card = document.querySelector("#card");
  if (!card || card.hidden) {
    audio.pause();
    playing = "";
    return;
  }
  play(card.dataset.mark);
}
const card = document.querySelector("#card");
if (card) new MutationObserver(sync).observe(card, {attributes: true, attributeFilter: ["hidden", "data-mark"]});
document.querySelector("#cardReplay")?.addEventListener("click", () => play(card?.dataset.mark, true));
document.querySelector("#cardClose")?.addEventListener("click", () => { audio.pause(); playing = ""; });

const back = document.createElement("button");
back.type = "button";
back.id = "linkedMapReturn";
back.textContent = "返回地图";
function leave() {
  audio.pause();
  if (window.parent !== window) {
    window.parent.postMessage("strata-close-walk", location.origin);
    return;
  }
  location.assign(`/v06b/map/index.html?lang=${lang}`);
}
back.addEventListener("click", leave);
document.body.append(back);
sync();

// walk.js closes an open card on Escape; only an Escape with no card open leaves.
let cardWasOpen = false;
window.addEventListener("keydown", event => {
  if (event.key === "Escape") cardWasOpen = Boolean(card && !card.hidden);
}, true);
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && !cardWasOpen) leave();
});

// The stand-in boxes stay under this cover until the World Labs world is mounted
// (walk.js raises camera.far from 80 to 240 at that moment).
const cover = document.querySelector("#linkedCaveLoading");
const bar = document.querySelector("#linkedCaveBar");
const started = performance.now();
function reveal() {
  if (!cover || cover.hidden) return;
  if (bar) bar.style.width = "100%";
  cover.style.opacity = "0";
  setTimeout(() => { cover.hidden = true; }, 500);
}
function waitForWorld() {
  if (!cover || cover.hidden) return;
  const ready = (window.__shoushan?.camera?.far || 0) > 80;
  const waited = performance.now() - started;
  if (ready) return reveal();
  if (waited > 30000) {
    const label = document.querySelector("#linkedCaveLabel");
    if (label) label.textContent = "远景还没接上，先看示意。";
    return setTimeout(reveal, 1200);
  }
  if (bar) bar.style.width = `${Math.min(92, 8 + waited / 120)}%`;
  requestAnimationFrame(waitForWorld);
}
waitForWorld();
