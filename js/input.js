/* === 📥 输入模块 === */

const InputModule = (() => {
  let scannedResult = null; // 当前扫描结果
  let selectedItems = new Set();

  function init() {
    render();
  }

  function render() {
    const panel = document.getElementById("panel-input");
    panel.innerHTML = `
      <div class="input-container">
        <!-- 操作区 -->
        <div class="card" id="capture-card">
          <div class="card-header">📸 拍照翻译</div>
          <p class="card-desc">拍摄英语阅读材料，AI 自动识别、翻译并提取生词</p>
          <div class="capture-actions">
            <button class="btn-capture" id="btn-capture">
              <span class="btn-icon">📷</span>
              <span>拍照</span>
            </button>
            <button class="btn-capture secondary" id="btn-gallery">
              <span class="btn-icon">🖼️</span>
              <span>相册</span>
            </button>
          </div>
          <div class="divider">
            <span>或</span>
          </div>
          <div class="source-input">
            <input type="text" id="input-source" placeholder="输入来源（书名/文章名，可选）" maxlength="100">
          </div>
        </div>

        <!-- 扫描结果区 -->
        <div id="scan-result-area"></div>
      </div>
    `;

    // 绑定事件
    document.getElementById("btn-capture").addEventListener("click", () => doScan("camera"));
    document.getElementById("btn-gallery").addEventListener("click", () => doScan("gallery"));
  }

  async function doScan(mode) {
    const key = Utils.getApiKey();
    if (!key) {
      Utils.toast("⚠️ 请先在设置中填写 DeepSeek API Key");
      return;
    }

    try {
      Utils.showLoading(mode === "camera" ? "拍照中…" : "读取图片…");
      const image = mode === "camera" ? await Camera.capture() : await Camera.pickFromGallery();

      Utils.showLoading("AI 识别翻译中…");
      scannedResult = await AI.scanPhoto(image);

      Utils.hideLoading();

      if (!scannedResult || scannedResult.items.length === 0) {
        Utils.toast("未识别到英文文本，请重拍");
        return;
      }

      selectedItems.clear();
      renderScanResult();
    } catch (err) {
      Utils.hideLoading();
      Utils.toast(`❌ ${err.message}`);
      console.error(err);
    }
  }

  function renderScanResult() {
    const area = document.getElementById("scan-result-area");
    area.innerHTML = `
      <div class="card">
        <div class="card-header">📖 识别结果</div>
        <div class="scan-fulltext">${escapeHtml(scannedResult.fullText)}</div>
      </div>

      <div class="card">
        <div class="card-header">
          🏷️ 选择生词入库
          <span class="badge" id="selected-count">0</span>
        </div>
        <div class="select-actions">
          <button class="btn-sm" id="btn-select-all">全选</button>
          <button class="btn-sm" id="btn-deselect-all">取消全选</button>
        </div>
        <div class="item-list" id="item-list">
          ${scannedResult.items.map((item, i) => `
            <label class="item-row ${selectedItems.has(i) ? 'selected' : ''}" data-index="${i}">
              <input type="checkbox" ${selectedItems.has(i) ? 'checked' : ''} data-index="${i}">
              <div class="item-info">
                <div class="item-text">
                  <span class="type-tag tag-${item.type}">${typeLabel(item.type)}</span>
                  ${escapeHtml(item.text)}
                </div>
                <div class="item-trans">${escapeHtml(item.translation)}</div>
              </div>
            </label>
          `).join("")}
        </div>
      </div>

      <button class="btn-primary" id="btn-save-words">💾 保存生词</button>
    `;

    // 勾选事件
    document.querySelectorAll("#item-list input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const idx = parseInt(e.target.dataset.index);
        if (cb.checked) selectedItems.add(idx); else selectedItems.delete(idx);
        updateCount();
      });
    });

    // 全选/取消
    document.getElementById("btn-select-all").addEventListener("click", () => {
      scannedResult.items.forEach((_, i) => selectedItems.add(i));
      document.querySelectorAll("#item-list input[type=checkbox]").forEach(cb => cb.checked = true);
      updateCount();
    });
    document.getElementById("btn-deselect-all").addEventListener("click", () => {
      selectedItems.clear();
      document.querySelectorAll("#item-list input[type=checkbox]").forEach(cb => cb.checked = false);
      updateCount();
    });

    // 保存
    document.getElementById("btn-save-words").addEventListener("click", saveWords);

    updateCount();
    area.scrollIntoView({ behavior: "smooth" });
  }

  function updateCount() {
    const el = document.getElementById("selected-count");
    if (el) el.textContent = selectedItems.size;
  }

  async function saveWords() {
    if (selectedItems.size === 0) {
      Utils.toast("请至少选择一个生词");
      return;
    }

    const source = document.getElementById("input-source").value.trim() || "未分类";
    const photoSnapshot = scannedResult.fullText.slice(0, 500); // 截取前500字符作为快照

    let saved = 0;
    for (const idx of selectedItems) {
      const item = scannedResult.items[idx];
      await DB.addWord({
        text: item.text,
        type: item.type,
        translation: item.translation,
        source: source,
        originalSentence: scannedResult.fullText,
        photoSnapshot: photoSnapshot,
        createdAt: Utils.today()
      });
      saved++;
    }

    await DB.logStudy(Utils.today(), { newWords: saved });

    Utils.toast(`✅ 已保存 ${saved} 个生词`);
    selectedItems.clear();
    scannedResult = null;
    render(); // 回到初始状态
  }

  function typeLabel(type) {
    return { word: "单词", phrase: "短语", sentence: "句子" }[type] || type;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { init };
})();
