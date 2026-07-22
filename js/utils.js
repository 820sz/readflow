/* === ReadFlow 工具函数 === */

const Utils = {
  /** 格式化日期为 YYYY-MM-DD */
  today() {
    return new Date().toISOString().slice(0, 10);
  },

  /** 格式化日期为中文 */
  formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  },

  /** 生成唯一 ID */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  /** 防抖 */
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  /** Toast 提示 */
  toast(msg, duration = 2000) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.add("hidden"), duration);
  },

  /** 显示/隐藏 loading */
  showLoading(text = "处理中…") {
    document.getElementById("loading-text").textContent = text;
    document.getElementById("loading-overlay").classList.remove("hidden");
  },
  hideLoading() {
    document.getElementById("loading-overlay").classList.add("hidden");
  },

  /** 获取本地存储的 API Key */
  getApiKey() {
    return localStorage.getItem("readflow_ds_key") || "";
  },

  /** 保存 API Key */
  setApiKey(key) {
    localStorage.setItem("readflow_ds_key", key.trim());
  },

  /** 确认对话框 */
  async confirm(msg) {
    return new Promise(resolve => {
      if (!window.confirm(msg)) { resolve(false); return; }
      resolve(true);
    });
  },

  /** 图片 base64 压缩 */
  compressImage(base64, maxW = 1200, quality = 0.8) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxW) { height = (height * maxW) / width; width = maxW; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = base64;
    });
  }
};
