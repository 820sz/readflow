/* === ReadFlow 主入口 === */

const App = (() => {
  let currentPanel = "input";

  function init() {
    // ====== 全局错误捕获：任何未处理的错误都显示出来 ======
    window.addEventListener("error", (e) => {
      const msg = `[${e.filename?.split("/").pop() || "?"}:${e.lineno}] ${e.message}`;
      console.error("GLOBAL ERROR:", msg, e.error);
      Utils.hideLoading();
      // 显示 10 秒，确保用户能看清
      const el = document.getElementById("toast");
      el.textContent = `❌ ${msg}`;
      el.classList.remove("hidden");
      el.style.whiteSpace = "pre-wrap";
      el.style.maxWidth = "90vw";
      el.style.fontSize = "12px";
      clearTimeout(el._timeout);
      el._timeout = setTimeout(() => {
        el.classList.add("hidden");
        el.style.whiteSpace = "nowrap";
        el.style.maxWidth = "";
        el.style.fontSize = "";
      }, 10000);
    });

    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason;
      const msg = reason?.message || String(reason);
      const stack = reason?.stack || "";
      const fileLine = stack.match(/(\w+\.js):(\d+)/);
      const loc = fileLine ? `[${fileLine[1]}:${fileLine[2]}]` : "";
      console.error("UNHANDLED REJECTION:", loc, msg, reason);
      Utils.hideLoading();
      const el = document.getElementById("toast");
      el.textContent = `❌ ${loc} ${msg}`;
      el.classList.remove("hidden");
      el.style.whiteSpace = "pre-wrap";
      el.style.maxWidth = "90vw";
      el.style.fontSize = "12px";
      clearTimeout(el._timeout);
      el._timeout = setTimeout(() => {
        el.classList.add("hidden");
        el.style.whiteSpace = "nowrap";
        el.style.maxWidth = "";
        el.style.fontSize = "";
      }, 10000);
    });
    // ====== 全局错误捕获结束 ======

    // 注册 Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }

    // 底部导航绑定
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => switchPanel(btn.dataset.panel));
    });

    // 设置面板
    document.getElementById("btn-settings").addEventListener("click", openSettings);
    document.getElementById("btn-settings-close").addEventListener("click", closeSettings);
    document.getElementById("btn-save-settings").addEventListener("click", saveSettings);

    // 加载已保存的 API Key
    const savedKey = Utils.getApiKey();
    if (savedKey) {
      document.getElementById("setting-api-key").value = savedKey;
    }

    // 初始化各模块
    InputModule.init();
    OutputModule.init();
    ProfileModule.init();

    // 检查是否首次使用
    checkFirstRun();
  }

  function switchPanel(name) {
    if (currentPanel === name) return;
    currentPanel = name;

    // 更新面板
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    document.getElementById(`panel-${name}`).classList.add("active");

    // 更新导航
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`[data-panel="${name}"]`).classList.add("active");

    // 更新标题
    const titles = { input: "📥 输入", output: "📤 输出", me: "👤 我的" };
    document.getElementById("header-title").textContent = titles[name] || "ReadFlow";

    // 触发面板刷新
    if (name === "me") ProfileModule.refresh();
    if (name === "output") OutputModule.refresh();
  }

  function openSettings() {
    const key = Utils.getApiKey();
    document.getElementById("setting-api-key").value = key;
    document.getElementById("settings-overlay").classList.remove("hidden");
  }

  function closeSettings() {
    document.getElementById("settings-overlay").classList.add("hidden");
  }

  function saveSettings() {
    const key = document.getElementById("setting-api-key").value.trim();
    Utils.setApiKey(key);
    Utils.toast(key ? "API Key 已保存 ✓" : "API Key 已清除");
    closeSettings();
  }

  async function checkFirstRun() {
    const key = Utils.getApiKey();
    if (!key) {
      // 首次使用，提示设置 API Key
      setTimeout(() => {
        Utils.toast("👋 请先点击右上角 ⚙️ 设置 API Key", 3000);
      }, 500);
    }
  }

  return { init, switchPanel };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
