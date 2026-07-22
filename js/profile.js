/* === 👤 我的模块 === */

const ProfileModule = (() => {
  function init() {
    render();
  }

  function refresh() {
    render();
    loadStats();
    loadVocabularyList();
  }

  function render() {
    const panel = document.getElementById("panel-me");
    panel.innerHTML = `
      <div class="profile-container">
        <!-- 统计数据 -->
        <div class="stats-grid" id="stats-grid">
          <div class="stat-card">
            <div class="stat-number" id="stat-total-words">--</div>
            <div class="stat-label">总生词</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" id="stat-days">--</div>
            <div class="stat-label">学习天数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number" id="stat-exercises">--</div>
            <div class="stat-label">练习次数</div>
          </div>
        </div>

        <!-- 学习日历 -->
        <div class="card">
          <div class="card-header">📅 学习日历</div>
          <canvas id="calendar-canvas" width="340" height="140"></canvas>
        </div>

        <!-- 词汇量曲线 -->
        <div class="card">
          <div class="card-header">📈 词汇量增长</div>
          <canvas id="growth-canvas" width="340" height="180"></canvas>
        </div>

        <!-- 生词列表（按来源分类） -->
        <div class="card">
          <div class="card-header">📚 生词库（按来源）</div>
          <div id="vocab-by-source"></div>
        </div>

        <!-- AI 个性化建议 -->
        <div class="card">
          <div class="card-header">🤖 AI 学习建议</div>
          <button class="btn-primary" id="btn-get-advice">获取个性化建议</button>
          <div id="advice-result"></div>
        </div>
      </div>
    `;

    loadStats();
    loadVocabularyList();
    document.getElementById("btn-get-advice").addEventListener("click", getAdvice);
  }

  async function loadStats() {
    try {
      const [words, logs, exercises] = await Promise.all([
        DB.getWords(),
        DB.getStudyLogs(),
        DB.getExercises()
      ]);

      const totalWords = words.length;
      const totalDays = logs.length;
      const totalExercises = exercises.length;

      document.getElementById("stat-total-words").textContent = totalWords;
      document.getElementById("stat-days").textContent = totalDays;
      document.getElementById("stat-exercises").textContent = totalExercises;

      drawCalendar(logs);
      drawGrowthChart(words, logs);
    } catch (err) {
      console.error("加载统计数据失败:", err);
    }
  }

  async function loadVocabularyList() {
    const words = await DB.getWords();
    // 按来源分组
    const bySource = {};
    words.forEach(w => {
      const src = w.source || "未分类";
      if (!bySource[src]) bySource[src] = [];
      bySource[src].push(w);
    });

    const container = document.getElementById("vocab-by-source");
    if (Object.keys(bySource).length === 0) {
      container.innerHTML = '<p class="empty-hint">暂无生词，去「输入」开始收集吧 📸</p>';
      return;
    }

    container.innerHTML = Object.entries(bySource).map(([source, words]) => `
      <div class="source-group">
        <div class="source-header" data-source="${escapeHtml(source)}">
          <span>📖 ${escapeHtml(source)}</span>
          <span class="source-count">${words.length} 词</span>
        </div>
        <div class="source-words hidden" id="words-${slug(source)}">
          ${words.slice(0, 5).map(w => `
            <div class="mini-word">
              <span class="mini-text">${escapeHtml(w.text)}</span>
              <span class="mini-trans">${escapeHtml(w.translation)}</span>
            </div>
          `).join("")}
          ${words.length > 5 ? `<p class="more-hint">...还有 ${words.length - 5} 个词</p>` : ""}
        </div>
      </div>
    `).join("");

    // 展开/折叠
    document.querySelectorAll(".source-header").forEach(header => {
      header.addEventListener("click", () => {
        const target = document.getElementById(`words-${slug(header.dataset.source)}`);
        target.classList.toggle("hidden");
      });
    });
  }

  async function getAdvice() {
    const key = Utils.getApiKey();
    if (!key) { Utils.toast("⚠️ 请先设置 API Key"); return; }

    const words = await DB.getWords();
    const logs = await DB.getStudyLogs();
    const exercises = await DB.getExercises();

    // 构建用户画像
    const profile = {
      totalWords: words.length,
      studyDays: logs.length,
      exerciseCount: exercises.length,
      sources: [...new Set(words.map(w => w.source))],
      wordTypes: {
        words: words.filter(w => w.type === "word").length,
        phrases: words.filter(w => w.type === "phrase").length,
        sentences: words.filter(w => w.type === "sentence").length
      },
      recentWords: words.slice(-20).map(w => w.text)
    };

    try {
      Utils.showLoading("AI 分析中…");
      const advice = await AI.getStudyAdvice(profile);
      Utils.hideLoading();

      document.getElementById("advice-result").innerHTML = `
        <div class="advice-box">
          <div class="advice-item">
            <strong>📊 当前水平：</strong>${escapeHtml(advice.currentLevel)}
          </div>
          <div class="advice-item">
            <strong>🎯 下一步：</strong>
            <ul>${advice.nextSteps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
          </div>
          <div class="advice-item">
            <strong>📖 材料推荐：</strong>${escapeHtml(advice.materialRecommendation)}
          </div>
          <div class="advice-item">
            <strong>💡 方法建议：</strong>
            <ul>${advice.methodTips.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
          </div>
          <div class="advice-item">
            <strong>🔍 重点加强：</strong>
            <ul>${advice.focusAreas.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
          </div>
        </div>
      `;
    } catch (err) {
      Utils.hideLoading();
      Utils.toast(`❌ ${err.message}`);
    }
  }

  // --- 图表绘制 ---

  function drawCalendar(logs) {
    const canvas = document.getElementById("calendar-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const dates = new Set(logs.map(l => l.date));
    // 画最近 20 周
    const cols = 20, rows = 7;
    const cellSize = 14, gap = 3, left = 20, top = 16;
    const today = new Date();

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const d = new Date(today);
        d.setDate(d.getDate() - ((cols - 1 - col) * 7 + (6 - row)));
        const dateStr = d.toISOString().slice(0, 10);
        const hasActivity = dates.has(dateStr);

        const x = left + col * (cellSize + gap);
        const y = top + row * (cellSize + gap);

        ctx.fillStyle = hasActivity ? "#4a6cf7" : "#e5e7eb";
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 3);
        ctx.fill();
      }
    }

    // 图例
    ctx.fillStyle = "#6b7280";
    ctx.font = "10px sans-serif";
    ctx.fillText("少", left, h - 8);
    ctx.fillStyle = "#e5e7eb"; ctx.beginPath(); ctx.roundRect(left + 20, h - 14, 12, 12, 2); ctx.fill();
    ctx.fillStyle = "#4a6cf7"; ctx.beginPath(); ctx.roundRect(left + 36, h - 14, 12, 12, 2); ctx.fill();
    ctx.fillStyle = "#6b7280"; ctx.fillText("多", left + 54, h - 8);
  }

  function drawGrowthChart(words, logs) {
    const canvas = document.getElementById("growth-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (words.length === 0) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("暂无数据", w / 2, h / 2);
      return;
    }

    // 按日期累计词汇量
    const sorted = [...words].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const cumMap = {};
    sorted.forEach(w => {
      const d = w.createdAt;
      cumMap[d] = (cumMap[d] || 0) + 1;
    });

    const dates = Object.keys(cumMap).sort();
    let running = 0;
    const points = dates.map(d => {
      running += cumMap[d];
      return { date: d, count: running };
    });

    // 画折线图
    const pad = { top: 16, right: 24, bottom: 30, left: 36 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;
    const maxCount = points[points.length - 1].count || 1;

    // 坐标轴
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + ph);
    ctx.lineTo(pad.left + pw, pad.top + ph);
    ctx.stroke();

    // 数据线
    if (points.length >= 2) {
      ctx.strokeStyle = "#4a6cf7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = pad.left + (i / (points.length - 1)) * pw;
        const y = pad.top + ph - (p.count / maxCount) * ph;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 数据点
      points.forEach((p, i) => {
        const x = pad.left + (i / (points.length - 1)) * pw;
        const y = pad.top + ph - (p.count / maxCount) * ph;
        ctx.fillStyle = "#4a6cf7";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 最后值
    const last = points[points.length - 1];
    ctx.fillStyle = "#4a6cf7";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${last.count} 词`, w - pad.right, pad.top + ph - (last.count / maxCount) * ph - 6);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function slug(str) {
    return str.replace(/[^a-zA-Z0-9一-龥]/g, "_").slice(0, 40);
  }

  return { init, refresh };
})();
