# 升本 · 语文政治（iOS App / 网页版）

一个为「新疆统招专升本（只考语文 150 + 政治 150）」做的备考 App：

- **倒计时**：距 2030-04-10 考试的天数、学习进度、连续打卡、里程碑（报名日/考试日）
- **背诵**：314 张预置卡（语文 180 + 政治 134，12 个章节），两级筛选；**默认选择题模式**（ABCD 点选即判对错，干扰项取同章节其他卡片），可切换翻卡自评（4 档间隔重复）
- **错题本**：录真题错题，按知识点标签归类，答对 3 次判定「掌握」
- **计划**：本周任务清单 + 完成度
- **模拟考**：语文/政治各 120 分钟整卷计时，可暂停、交卷记分、看平均分
- **AI**：填自己的 API Key（DeepSeek / OpenAI 兼容接口均可）→ 错题讲解、按主题造卡、按周排计划
- **数据**：全部存本机（iOS 走 UserDefaults，网页走 localStorage），支持导出 / 导入 JSON 备份

---

## 一、最快用起来：网页版（0 分钟，不用装）

直接打开 `web/index.html` 即可。iPhone 上「Safari → 分享 → 添加到主屏幕」，就是一个全屏、可离线使用的 App，和装 IPA 体验几乎一样。

## 二、打包成 IPA（GitHub Actions 云端编译，不需要 Mac）

> 原理：Swift 代码无法在 iPhone 上编译，所以交给 GitHub 的 macOS 机器。你只需要一个有 GitHub 账号的仓库。

### 步骤

1. **建仓库**：GitHub → New repository → 名字随意（如 `zkb-app`）→ 选 **Public**（公开仓库的 Actions 免额度）→ Create。
2. **上传整个 `zkb-app` 文件夹**（保持目录结构）：
   - 网页版：仓库首页 → `Add file` → `Upload files` → 把 `ios`、`web`、`.github` 三个文件夹拖进去 → Commit。
   - 或命令行：
     ```bash
     git init && git add . && git commit -m "init"
     git branch -M main
     git remote add origin https://github.com/<你的用户名>/zkb-app.git
     git push -u origin main
     ```
   - 注意 `.github` 是隐藏目录，Windows 资源管理器要勾选「显示隐藏项目」，Mac 按 `Cmd+Shift+.`。
3. **等它自己编译**：仓库顶部 `Actions` → 看到 `Build unsigned IPA` 正在跑（约 5–10 分钟，第一次要装 XcodeGen）。
4. **下载**：跑完后点进那次运行 → 页面底部 `Artifacts` → `ShengBen-unsigned-ipa` → 下载 ZIP → 解压得到 `ShengBen-unsigned.ipa`。
5. **签名安装**：用你惯用的方式（ESign / 轻松签 / Sideloadly 等）导入 ipa + 证书签名。
6. **信任**：设置 → 通用 → VPN 与设备管理 → 信任你的证书。

### 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| Actions 里没有这个 workflow | `.github/workflows/build-ipa.yml` 没上传成功（隐藏目录漏了）；或仓库默认分支不是 `main`/`master`，去 workflow 页面点 `Run workflow` 手动跑 |
| 编译失败，报 `xcodegen: command not found` | Homebrew 步骤失败，重跑一次即可（偶发网络问题） |
| 报 `Signing for "ShengBen" requires a development team` | 说明 `CODE_SIGNING_ALLOWED=NO` 没生效；确认用的是本仓库自带的 workflow，别改那几行 |
| 安装后闪退 | 签名不完整（尤其免费证书 / 证书过期）；重签一次；或确认 iPhone 是 arm64（全部现代机型都是） |
| 打开是白屏 | 说明 `web/` 没打进 App。检查 `ios/project.yml` 里 `- path: ../web` 是否存在、`web/index.html` 是否在仓库里 |

### 想改的东西在哪

| 改动 | 文件 |
|---|---|
| App 名称（桌面显示） | `ios/project.yml` → `CFBundleDisplayName` |
| Bundle ID（重签时要一致） | `ios/project.yml` → `PRODUCT_BUNDLE_IDENTIFIER` |
| App 图标 | 替换 `ios/Sources/Assets.xcassets/AppIcon.appiconset/icon-1024.png`（1024×1024） |
| 预置题库 / 任务 | `web/data/seed.js`（只影响新装/重置后的初始数据） |
| 界面与逻辑 | `web/index.html`、`web/styles.css`、`web/app.js` |
| 倒计时默认考试日 | `web/app.js` → `defaults().settings.exam`（App 内也可直接改） |

---

## 三、AI 配置

设置 → AI：

- **接口地址**：DeepSeek 填 `https://api.deepseek.com/v1`；OpenAI 填 `https://api.openai.com/v1`；其他兼容服务填对应 `.../v1`。
- **模型**：如 `deepseek-chat`、`gpt-4o-mini`。
- **API Key**：只存在本机，请求直接发往你填的接口，不经过任何中间服务器。

三个 AI 功能：错题「AI 讲解」→ 生成【考点】【我错在哪】【正确思路】【记住一句话】，可一键存为解析；背诵页「AI 造卡」→ 按主题生成卡片，预览后批量入库；计划页「AI 排计划」→ 按每周可用时间和薄弱点生成 5 条任务。

---

## 四、目录结构

```
zkb-app/
├─ web/                     ← App 本体（也是可独立使用的网页版）
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js                ← 全部逻辑（路由 / SRS / 错题 / 计划 / AI）
│  ├─ sw.js                 ← 离线缓存（网页版用）
│  ├─ manifest.webmanifest
│  └─ data/seed.js          ← 预置 46 张卡 + 3 道样例错题 + 5 条周任务
├─ ios/
│  ├─ project.yml           ← XcodeGen 工程描述（不用手写 .xcodeproj）
│  └─ Sources/
│     ├─ App.swift          ← ~140 行 WKWebView 外壳 + UserDefaults 桥
│     └─ Assets.xcassets/
└─ .github/workflows/build-ipa.yml   ← 云端编译 + 打包未签名 ipa
```

## 五、说明与边界

- 这是**本地工具**，不联网同步、不收集数据；换机请用「设置 → 导出备份」。
- 预置题库是起始内容（古诗文默写均为常见名句，政治以框架性原理为主），**不能替代真题**；考试大纲请以新疆教育考试院当年公告与学校教材为准。
- 免费开发者证书签名 7 天过期、企业证书 1 年，重签时请**保持 Bundle ID 不变**，否则数据会分成两套。
