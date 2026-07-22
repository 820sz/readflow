/* === DeepSeek API 模块 === */

const AI = (() => {
  const BASE = "https://api.deepseek.com";

  function getKey() {
    const key = Utils.getApiKey();
    if (!key) throw new Error("请先在设置中填写 DeepSeek API Key");
    return key;
  }

  /** 通用请求 */
  async function chat(messages, { temperature = 0.7, max_tokens = 4096 } = {}) {
    const resp = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getKey()}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature,
        max_tokens
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `API 请求失败 (${resp.status})`);
    }
    const data = await resp.json();
    return data.choices[0].message.content;
  }

  /** Vision：拍照 → OCR + 翻译 + 分类 */
  async function scanPhoto(base64Image) {
    const prompt = `你是一个专业的英语学习助手。请分析这张照片中的英文文本，完成以下任务，并以 JSON 格式返回结果：

1. **OCR 识别**：识别照片中所有的英文文本
2. **逐条翻译**：将文本拆分为以下三类，逐条给出原文+中文翻译：
   - "words"：单个单词
   - "phrases"：短语/固定搭配
   - "sentences"：完整句子
3. **出处标记**：每条记录附上它在原文中出现的位置

返回格式严格为：
{
  "fullText": "照片中完整的英文原文",
  "items": [
    { "text": "单词/短语/句子", "type": "word|phrase|sentence", "translation": "中文翻译" }
  ]
}

注意：
- 如果照片中没有任何英文文本，返回 {"fullText": "", "items": []}
- 不要漏掉任何单词、短语或句子
- 翻译要准确、符合语境`;

    const content = [
      {
        type: "image_url",
        image_url: { url: base64Image }
      },
      {
        type: "text",
        text: prompt
      }
    ];

    const resp = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getKey()}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content }],
        temperature: 0.3,
        max_tokens: 4096
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Vision API 失败 (${resp.status})`);
    }
    const data = await resp.json();
    const raw = data.choices[0].message.content;

    // 提取 JSON（可能被 markdown 代码块包裹）
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      // 尝试直接解析
      return JSON.parse(raw);
    }
  }

  /** 生成含生词文章 */
  async function generateArticle(words, level = "intermediate") {
    const wordList = words.map(w => w.text).join("、");
    const prompt = `你是一个专业的英语教学文章作者。请根据以下生词列表，创作一篇有趣的英语文章：

生词列表：${wordList}

要求：
1. 文章中必须自然而然地包含以上所有生词（可以在文中加粗标记）
2. 文章难度对应英语水平：${level}（beginner/intermediate/advanced）
3. 文章长度：300-500 词
4. 主题要有趣、贴近日常生活，不要像教科书
5. 文章末尾给出中文摘要

返回 JSON：
{
  "title": "文章标题",
  "content": "英语文章内容",
  "summary": "中文摘要",
  "wordsUsed": ["使用的生词1", "使用的生词2"]
}`;

    const resp = await chat([{ role: "user", content: prompt }], { temperature: 0.8, max_tokens: 4096 });
    const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, resp];
    return JSON.parse(jsonMatch[1].trim());
  }

  /** 生成回译练习 */
  async function generateBackTranslation(article) {
    const prompt = `请将以下英语文章翻译成地道的中文，用于回译练习（用户会看着中文翻回英文）：

${article}

要求：
1. 中文要自然地道，不要直译（保留一定的翻译空间给用户发挥）
2. 分段对应原文段落

返回 JSON：
{ "chinese": "中文译文" }`;

    const resp = await chat([{ role: "user", content: prompt }], { temperature: 0.5 });
    const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, resp];
    return JSON.parse(jsonMatch[1].trim());
  }

  /** 结构化纠错 */
  async function correctWriting(originalPrompt, userWriting) {
    const prompt = `你是一位专业、严谨的英语写作导师。请对学生的回译练习进行纠错分析。

=== 原文（中文提示）===
${originalPrompt}

=== 学生译文 ===
${userWriting}

请从以下三个维度进行逐条分析，返回 JSON：

{
  "overallScore": "7/10",
  "overallComment": "总体评价",
  "vocabularyErrors": [
    { "type": "spelling|usage", "error": "错误写法", "correction": "正确写法", "note": "分析说明" }
  ],
  "grammarErrors": [
    { "type": "morphology|syntax", "error": "错误写法", "correction": "正确写法", "note": "分析说明" }
  ],
  "improvements": [
    { "original": "原表达", "suggestion": "优化建议", "note": "为什么更好" }
  ]
}

分类说明：
- vocabularyErrors.type: "spelling"=拼写错误, "usage"=中英互译问题/用词不当/中式英语
- grammarErrors.type: "morphology"=词法错误(时态/语态/单复数/冠词), "syntax"=句法错误(语序/从句/主谓一致)
- improvements: 表达可优化的地方（更地道/更简洁/更高级）

要求：
- 逐条、精确地指出每个错误
- 给出一针见血的分析，不要泛泛而谈
- 如果某类没有错误，返回空数组 []`;

    const resp = await chat([{ role: "user", content: prompt }], { temperature: 0.3, max_tokens: 4096 });
    const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, resp];
    return JSON.parse(jsonMatch[1].trim());
  }

  /** 个性化学习建议 */
  async function getStudyAdvice(profile) {
    const prompt = `你是一位资深的英语学习顾问。根据以下用户画像，给出个性化的学习建议：

用户画像：
${JSON.stringify(profile, null, 2)}

请从以下维度给出建议，返回 JSON：
{
  "currentLevel": "用户当前水平的评估",
  "nextSteps": ["下一步学习建议1", "建议2"],
  "materialRecommendation": "推荐的阅读材料类型和难度",
  "methodTips": ["学习方法建议1", "建议2"],
  "focusAreas": ["需要重点加强的领域1", "领域2"]
}`;

    const resp = await chat([{ role: "user", content: prompt }], { temperature: 0.7 });
    const jsonMatch = resp.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, resp];
    return JSON.parse(jsonMatch[1].trim());
  }

  return { chat, scanPhoto, generateArticle, generateBackTranslation, correctWriting, getStudyAdvice };
})();
