// Applies a saved appearance (Settings) before the first paint, so a Dark or Crimson choice never flashes light. A file, not an
// inline script: the site's Content-Security-Policy allows scripts from its own origin only. Mirrors src/lib/theme.ts
// (key, values, colors); src/lib/theme.test.ts runs this file and fails if the two disagree.
(function () {
  var COLOR = { light: "#ffffff", dark: "#1d3549", crimson: "#171113" };
  try {
    var t = window.localStorage.getItem("alcohol-dashboard.theme.v1");
    if (t !== "light" && t !== "dark" && t !== "crimson") return;
    document.documentElement.setAttribute("data-theme", t);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", COLOR[t]);
  } catch (e) {
    // Blocked storage: the device decides, as with no choice.
  }
})();
