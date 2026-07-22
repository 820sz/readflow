/* === 📤 输出模块 === */

const OutputModule = (() => {
  let currentArticle = null;
  let currentBackTrans = null;

  function init() {
    render();
  }

  function refresh() {
    render();
  }

  function render() {
    const panel = document.getElementById("panel-output");
    panel.innerHTML = `
      <div class="output-container">
        <!-- AI 文章区 -->
        <div class="card" id="article-card">
          <div class="card-header">📝 AI 生成文章</div>
          <p class="card-desc">基于你的生词库，AI 生成包含这些词汇的英语文章</p>
          <div class="gen-options">
            <select id="article-level" class="select-sm">
              <option value="beginner">初级</option>
              <option value="intermediate" selected>中级</option>
              <option value="advanced">高级</option>
            </select>
            <button class="btn-primary" id="btn-gen-article">生成文章</button>
          </div>
          <div id="article-result"></div>
        </div>

        <!-- 回译练习区 -->
        <div id="backtrans-card" style="display:none;">
          <div class="card">
            <div class="card-header">🔄 回译练习</div>
            <p class="card-desc">看中文译文，翻译回英文</p>
            <div id="backtrans-chinese"></div>
            <div class="exercise-input">
              <textarea id="user-translation" placeholder="在这里写下你的英文翻译…" rows="6"></textarea>
              <div class="input-actions">
                <button class="btn-sm" id="btn-upload-photo">📷 拍照上传</button>
                <button class="btn-primary" id="btn-submit-exercise">提交纠错</button>
              </div>
            </div>
          </div>

          <!-- 纠错结果 -->
          <div id="correction-result"></div>
        </div>
      </div>
    `;

    // 事件绑定
    document.getElementById("btn-gen-article").addEventListener("click", generateArticle);
    document.getElementById("btn-submit-exercise")?.addEventListener("click", submitExercise);
    document.getElementById("btn-upload-photo")?.addEventListener("click", uploadPhotoAnswer);
  }

  async function generateArticle() {
    const key = Utils.getApiKey();
    if (!key) { Utils.toast("⚠️ 请先设置 API Key"); return; }

    const words = await DB.getWords();
    if (words.length < 5) {
      Utils.toast("⚠️ 生词少于5个，请先去「输入」收集更多生词");
      return;
    }

    // 选取最近收集的生词（最多20个）
    const recent = words.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);

    try {
      Utils.showLoading("AI 生成文章中…");
      const level = document.getElementById("article-level").value;
      currentArticle = await AI.generateArticle(recent, level);
      Utils.hideLoading();

      // 显示文章
      document.getElementById("article-result").innerHTML = `
        <div class="article-display">
          <h3 class="article-title">${escapeHtml(currentArticle.title)}</h3>
          <div class="article-content">${formatArticle(currentArticle.content)}</div>
          <div class="article-summary">
            <strong>📋 中文摘要：</strong>${escapeHtml(currentArticle.summary)}
          </div>
          <div class="article-words">
            <strong>📚 使用的生词：</strong>
            ${currentArticle.wordsUsed.map(w => `<span class="word-tag">${escapeHtml(w)}</span>`).join(" ")}
          </div>
        </div>
        <button class="btn-primary" id="btn-start-backtrans" style="margin-top:12px;">🔄 开始回译练习</button>
      `;

      document.getElementById("btn-start-backtrans").addEventListener("click", startBackTranslation);
    } catch (err) {
      Utils.hideLoading();
      Utils.toast(`❌ ${err.message}`);
      console.error(err);
    }
  }

  async function startBackTranslation() {
    Utils.showLoading("生成回译练习…");
    currentBackTrans = await AI.generateBackTranslation(currentArticle.content);
    Utils.hideLoading();

    const card = document.getElementById("backtrans-card");
    card.style.display = "block";
    document.getElementById("backtrans-chinese").innerHTML = `
      <div class="chinese-text">${escapeHtml(currentBackTrans.chinese)}</div>
    `;
    card.scrollIntoView({ behavior: "smooth" });
  }

  async function submitExercise() {
    const userWriting = document.getElementById("user-translation").value.trim();
    if (!userWriting) { Utils.toast("请先写下你的翻译"); return; }

    try {
      Utils.showLoading("AI 纠错中…");
      const correction = await AI.correctWriting(currentBackTrans.chinese, userWriting);
      Utils.hideLoading();

      // 保存练习记录
      await DB.addExercise({
        type: "backtranslation",
        prompt: currentBackTrans.chinese,
        userAnswer: userWriting,
        correction: correction
      });
      await DB.logStudy(Utils.today(), { reviewCount: 1 });

      // 展示纠错结果
      renderCorrection(correction);
    } catch (err) {
      Utils.hideLoading();
      Utils.toast(`❌ ${err.message}`);
    }
  }

  async function uploadPhotoAnswer() {
    try {
      const image = await Camera.pickFromGallery();
      Utils.showLoading("AI 识别文字中…");

      // 用 AI 从图片中提取文字
      const result = await AI.chat([
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: "请只提取图片中的所有英文文本，不要翻译，不要加任何解释。直接输出文本。" }
          ]
        }
      ], { temperature: 0.1, max_tokens: 2000 });

      Utils.hideLoading();
      document.getElementById("user-translation").value = result.trim();
      Utils.toast("✅ 文字已识别，可编辑后提交");
    } catch (err) {
      Utils.hideLoading();
      Utils.toast(`❌ ${err.message}`);
    }
  }

  function renderCorrection(correction) {
    const area = document.getElementById("correction-result");
    area.innerHTML = `
      <div class="card correction-card">
        <div class="card-header">📊 纠错报告</div>

        <div class="score-row">
          <span class="score-label">综合评分</span>
          <span class="score-value">${correction.overallScore}</span>
        </div>
        <p class="overall-comment">${correction.overallComment}</p>

        ${renderErrorSection("一、词汇错误", correction.vocabularyErrors, "vocab")}
        ${renderErrorSection("二、语法错误", correction.grammarErrors, "grammar")}
        ${renderImprovementsSection("三、表达优化", correction.improvements)}
      </div>
    `;
    area.scrollIntoView({ behavior: "smooth" });
  }

  function renderErrorSection(title, errors, cls) {
    if (!errors || errors.length === 0) return `
      <div class="error-section">
        <h4>${title}</h4>
        <p class="no-error">✅ 未发现错误</p>
      </div>
    `;

    return `
      <div class="error-section">
        <h4>${title}</h4>
        ${errors.map(e => `
          <div class="error-item">
            <div class="error-type">[${e.type}]</div>
            <div class="error-row">
              <span class="error-bad">❌ ${escapeHtml(e.error)}</span>
              <span>→</span>
              <span class="error-good">✅ ${escapeHtml(e.correction)}</span>
            </div>
            <div class="error-note">💡 ${escapeHtml(e.note)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderImprovementsSection(title, items) {
    if (!items || items.length === 0) return `
      <div class="error-section">
        <h4>${title}</h4>
        <p class="no-error">表达已经很好了 👍</p>
      </div>
    `;

    return `
      <div class="error-section">
        <h4>${title}</h4>
        ${items.map(i => `
          <div class="improve-item">
            <div class="improve-original">原文：${escapeHtml(i.original)}</div>
            <div class="improve-suggestion">建议：✨ ${escapeHtml(i.suggestion)}</div>
            <div class="improve-note">💡 ${escapeHtml(i.note)}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function formatArticle(text) {
    return text.replace(/\*\*(.+?)\*\*/g, '<strong class="hl-word">$1</strong>')
               .replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, refresh };
})();
