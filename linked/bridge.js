// Linked preview only. The published map bridge on port 4317 is left as it is.
function withLang(url) {
  let lang = "zh";
  try { lang = localStorage.getItem("intro-lang") === "en" ? "en" : "zh"; } catch { /* keep zh */ }
  const hashAt = url.indexOf("#");
  const hash = hashAt >= 0 ? url.slice(hashAt) : "";
  const base = hash ? url.slice(0, hashAt) : url;
  return `${base}${base.includes("?") ? "&" : "?"}lang=${lang}${hash}`;
}
export const sceneEntries = {
  "0-2": {name: "寿山仙人洞", ready: true, url: "/scenes/shoushan/index.html?from=map-v06b", note: "洞里的石器和骨头。句子对照展牌和一九九三年发掘报告。"},
  "1-2": {name: "左家山一期生活场景", ready: true, url: "/field/?scene=zuojiashan-phase1&from=map-v06b#journey", note: "一期后段的房前生活。二期石龙保留在地图资料中。"},
  "2-0": {name: "兴城二期", ready: false},
  "3-0": {name: "后太平", ready: false}
};
export function mapResume() {
  try { return new URLSearchParams(location.search).get("resume") === "left" && JSON.parse(localStorage.getItem("jilin-v05b-direct"))?.complete?.["1-2"] === true; } catch { return false; }
}
export function sceneActions(jsx, id, complete, next) {
  if (!complete || !sceneEntries[id]) return null;
  const scene = sceneEntries[id];
  const href = scene.url ? withLang(scene.url) : "";
  return jsx.jsxs("div", {className: "strata-scene-actions", children: [
    scene.ready ? jsx.jsx("a", {className: "strata-world-link", href, onClick: event => { if (typeof window.strataOpenWalk === "function") { event.preventDefault(); window.strataOpenWalk(href); } }, children: "进入" + scene.name + " →"}) : jsx.jsx("span", {className: "strata-world-pending", children: scene.name + " · 3D 漫游筹备中"}),
    jsx.jsx("small", {children: scene.ready ? scene.note : "本章观察已完成，后续将按当地资料制作可漫游场景。"}),
    next ? jsx.jsx("button", {type: "button", onClick: next, children: "继续下一章 →"}) : jsx.jsx("span", {children: "四个篇章已完成，可从上方回访。"})
  ]});
}
