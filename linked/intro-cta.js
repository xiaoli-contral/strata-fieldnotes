function currentLang() {
  return localStorage.getItem("intro-lang") === "en" ? "en" : "zh";
}
function syncMapLink() {
  const lang = currentLang();
  document.cookie = `strata-lang=${lang};path=/`;
  const link = document.querySelector(".cta-btn");
  if (link) link.href = `/v06b/map/index.html?lang=${lang}`;
}
syncMapLink();
document.querySelectorAll("#lang-switch button").forEach(button => {
  button.addEventListener("click", () => setTimeout(syncMapLink, 0));
});
document.querySelector(".cta-btn")?.addEventListener("click", syncMapLink);
