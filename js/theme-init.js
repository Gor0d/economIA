(() => {
  try {
    const savedTheme = localStorage.getItem("tokens-custo-theme");
    const systemTheme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = savedTheme || systemTheme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
