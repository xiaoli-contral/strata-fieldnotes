import {translate} from "/linked/phrases.mjs";

const params = new URLSearchParams(location.search);
const query = params.get("lang");
const stored = localStorage.getItem("intro-lang");
const lang = query === "en" || query === "zh" ? query : stored === "en" ? "en" : "zh";
localStorage.setItem("intro-lang", lang);
document.cookie = `strata-lang=${lang};path=/`;
document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
document.documentElement.dataset.strataLang = lang;

if (lang === "en") {
  const text = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  Object.defineProperty(Node.prototype, "textContent", {
    configurable: true,
    enumerable: text.enumerable,
    get() { return text.get.call(this); },
    set(value) {
      const next = typeof value === "string" ? translate(value) ?? value : value;
      if (next === text.get.call(this)) return;
      text.set.call(this, next);
    }
  });
  const nodeValue = Object.getOwnPropertyDescriptor(Node.prototype, "nodeValue");
  Object.defineProperty(Node.prototype, "nodeValue", {
    configurable: true,
    enumerable: nodeValue.enumerable,
    get() { return nodeValue.get.call(this); },
    set(value) {
      if (this.nodeType === Node.TEXT_NODE && typeof value === "string") {
        const next = translate(value) ?? value;
        if (next === nodeValue.get.call(this)) return;
        nodeValue.set.call(this, next);
        return;
      }
      nodeValue.set.call(this, value);
    }
  });
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (typeof value === "string" && /^(placeholder|aria-label|title|alt)$/.test(name)) {
      const next = translate(value);
      return setAttribute.call(this, name, next ?? value);
    }
    return setAttribute.call(this, name, value);
  };
  const scan = node => {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const next = translate(node.nodeValue || "");
      if (next && next !== node.nodeValue) node.nodeValue = next;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.id === "strataLangSwitch") return;
    for (const name of ["placeholder", "aria-label", "title", "alt"]) {
      if (!node.hasAttribute(name)) continue;
      const next = translate(node.getAttribute(name));
      if (next) setAttribute.call(node, name, next);
    }
    for (const child of [...node.childNodes]) scan(child);
  };
  scan(document.documentElement);
  const title = translate(document.title);
  if (title) document.title = title;
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") {
        const next = translate(record.target.nodeValue || "");
        if (next && next !== record.target.nodeValue) record.target.nodeValue = next;
      }
      for (const node of record.addedNodes) scan(node);
    }
  }).observe(document.documentElement, {subtree: true, childList: true, characterData: true});
}

const bar = document.createElement("div");
bar.id = "strataLangSwitch";
bar.setAttribute("aria-label", "Language");
for (const [id, label] of [["zh", "ZH"], ["en", "EN"]]) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.lang = id;
  button.textContent = label;
  if (id === lang) button.className = "is-active";
  button.addEventListener("click", () => {
    if (id === lang) return;
    localStorage.setItem("intro-lang", id);
    document.cookie = `strata-lang=${id};path=/`;
    const url = new URL(window.top.location.href);
    url.searchParams.set("lang", id);
    window.top.location.assign(url.toString());
  });
  if (bar.childNodes.length) {
    const sep = document.createElement("span");
    sep.textContent = "|";
    bar.append(sep);
  }
  bar.append(button);
}
document.documentElement.append(bar);
const style = document.createElement("style");
style.textContent = "#strataLangSwitch{position:fixed;top:14px;right:16px;z-index:40;display:flex;gap:8px;align-items:center;padding:6px 10px;border-radius:999px;background:#fff8eacc;color:#3d3426;font:600 12px/1 sans-serif;letter-spacing:.08em}#strataLangSwitch button{border:0;background:transparent;color:inherit;cursor:pointer;padding:0}#strataLangSwitch button.is-active{color:#8a5a12}#strataLangSwitch span{opacity:.45}#linkedMapReturn{position:fixed;bottom:18px;left:16px;z-index:40;padding:8px 14px;border:1px solid #b89a62;border-radius:999px;background:#fff8e6;color:#4e3d22;font:650 14px/1 sans-serif;cursor:pointer}";
document.documentElement.append(style);
