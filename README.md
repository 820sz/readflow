# ReadFlow — 阅读驱动英语学习

拍照翻译 → 生词收集 → AI 生成文章 → 回译练习 → 结构化纠错

## 技术栈

HTML + CSS + JS（Vanilla） · IndexedDB · DeepSeek API · PWA

## 快速开始

1. 在手机或电脑上打开 `index.html`（或部署到 GitHub Pages）
2. 点击右上角 ⚙️ 设置 DeepSeek API Key
3. 开始使用！

## 三个板块

| 📥 输入 | 📤 输出 | 👤 我的 |
|---------|---------|---------|
| 拍照翻译 | AI 生成文章 | 学习日历 |
| 生词收集 | 回译练习 | 词汇量曲线 |
| 出处标注 | 结构化纠错 | 个性化建议 |

## PWA 图标

打开 `assets/icons/generate-icons.html` 生成图标文件。

## 部署

推荐 **GitHub Pages**（免费）：
```bash
git init && git add . && git commit -m "init"
git remote add origin <你的仓库>
git push -u origin main
# Settings → Pages → 选 main 分支 → Save
```
