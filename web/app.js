/* 升本 · 语文政治 —— 单文件逻辑（无框架，离线可用） */
(function () {
  "use strict";

  const KEY = "zkb_state_v1";
  const DAY = 86400000;
  const yesterday = (d) => new Date(d.getTime() - DAY);

  /* ---------------- 存储 ---------------- */
  function defaults() {
    return {
      v: 1,
      settings: {
        exam: "2030-04-10",
        start: "2027-09-01",
        target: "",
        targetScore: 250,
        goal: 30,
        apiBase: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        apiKey: ""
      },
      cards: [],
      wrongs: [],
      tasks: [],
      exams: [],
      essays: [],
      stats: { days: {}, streak: 0, last: "" }
    };
  }

  function seed(state) {
    const now = Date.now();
    const perDay = 20;                        // 每天最多引入的新卡
    const deckSeen = {};
    (window.SEED.cards || []).forEach((c, i) => {
      const o = Array.isArray(c)
        ? { deck: c[0], tag: c[1], front: c[2], back: c[3] } : c;
      const k = o.deck || "语文";
      const n = deckSeen[k] = (deckSeen[k] || 0) + 1;
      state.cards.push({
        id: "c" + now + "_" + i, deck: k, tag: o.tag || "",
        front: o.front, back: o.back,
        due: now + Math.floor((n - 1) / perDay) * DAY,
        interval: 0, ease: 2.5, reps: 0, lapses: 0
      });
    });
    (window.SEED.wrongs || []).forEach((w, i) => {
      state.wrongs.push(Object.assign({
        id: "w" + now + "_" + i, streak: 0, createdAt: now
      }, w));
    });
    (window.SEED.tasks || []).forEach((t, i) => {
      state.tasks.push({ id: "t" + now + "_" + i, text: t.text, week: t.week || 0, done: false });
    });
    return state;
  }

  /* iOS 原生壳会把存档注入 window.__NATIVE_STATE__（UserDefaults），
     网页版则走 localStorage。两边都写，保证切换时数据不丢。 */
  const nativeBridge = () => {
    try { return (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.store) || null; }
    catch (e) { return null; }
  };

  let S;
  function load() {
    let raw = null;
    try { if (window.__NATIVE_STATE__) raw = window.__NATIVE_STATE__; } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; } }
    if (!raw) { S = seed(defaults()); save(); return; }
    try { S = Object.assign(defaults(), JSON.parse(raw)); }
    catch (e) { S = seed(defaults()); }
    if (!S.cards.length && !S.wrongs.length) seed(S);
  }
  function save() {
    let json;
    try { json = JSON.stringify(S); } catch (e) { return toast("保存失败"); }
    try { localStorage.setItem(KEY, json); } catch (e) {}
    const br = nativeBridge();
    if (br) { try { br.postMessage(json); } catch (e) {} }
  }

  /* ---------------- 工具 ---------------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const todayKey = () => iso(new Date());
  const parseDate = (s) => { const p = (s || "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2] || 1); };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._tm); t._tm = setTimeout(() => { t.hidden = true; }, 2200);
  }

  function sheet(title, html) {
    $("#sheet-title").textContent = title;
    $("#sheet-body").innerHTML = html;
    $("#sheet").hidden = false;
  }
  function closeSheet() { $("#sheet").hidden = true; }
  $("#sheet-close").onclick = closeSheet;
  $("#sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });

  /* ---------------- 路由 ---------------- */
  function go(name) {
    $$(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + name));
    $$("#tabbar .tab").forEach((b) => b.classList.toggle("active", b.dataset.go === name));
    window.scrollTo(0, 0);
    if (name === "home") renderHome();
    if (name === "cards") renderCards();
    if (name === "wrongs") renderWrongs();
    if (name === "plan") renderPlan();
    if (name === "settings") renderSettings();
  }
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-go]");
    if (el) { go(el.dataset.go); }
  });

  /* ---------------- 每日一句 ---------------- */
  const QUOTES = [
    ["不积跬步，无以至千里。", "《荀子·劝学》"],
    ["锲而不舍，金石可镂。", "《荀子·劝学》"],
    ["业精于勤，荒于嬉；行成于思，毁于随。", "韩愈《进学解》"],
    ["学而不思则罔，思而不学则殆。", "《论语》"],
    ["博观而约取，厚积而薄发。", "苏轼《稼说送张琥》"],
    ["千里之行，始于足下。", "《老子》"],
    ["纸上得来终觉浅，绝知此事要躬行。", "陆游《冬夜读书示子聿》"],
    ["宝剑锋从磨砺出，梅花香自苦寒来。", "《警世贤文》"],
    ["天行健，君子以自强不息。", "《周易》"],
    ["有志者，事竟成。", "《后汉书》"],
    ["少年易老学难成，一寸光阴不可轻。", "朱熹《偶成》"],
    ["黑发不知勤学早，白首方悔读书迟。", "颜真卿《劝学》"],
    ["读书破万卷，下笔如有神。", "杜甫《奉赠韦左丞丈》"],
    ["知之者不如好之者，好之者不如乐之者。", "《论语》"],
    ["苟日新，日日新，又日新。", "《礼记·大学》"],
    ["他山之石，可以攻玉。", "《诗经·小雅》"],
    ["路漫漫其修远兮，吾将上下而求索。", "屈原《离骚》"],
    ["博学之，审问之，慎思之，明辨之，笃行之。", "《礼记·中庸》"],
    ["绳锯木断，水滴石穿。", "《鹤林玉露》"],
    ["非学无以广才，非志无以成学。", "诸葛亮《诫子书》"],
    ["立身以立学为先，立学以读书为本。", "欧阳修"],
    ["为中华之崛起而读书。", "周恩来"],
    ["空谈误国，实干兴邦。", "时政"],
    ["幸福都是奋斗出来的。", "时政"],
    ["青年兴则国家兴，青年强则国家强。", "时政"],
    ["把论文写在祖国大地上。", "时政"],
    ["绿水青山就是金山银山。", "时政"],
    ["江山就是人民，人民就是江山。", "时政"],
    ["发展是解决我国一切问题的基础和关键。", "时政"],
    ["人才是第一资源，创新是第一动力。", "时政"],
    ["以人民为中心的发展思想。", "时政"],
    ["守正创新，笃行致远。", "时政"],
    ["文化自信是更基础、更广泛、更深厚的自信。", "时政"],
    ["中华民族伟大复兴，绝不是轻轻松松、敲锣打鼓就能实现的。", "时政"],
    ["每一代青年都有自己的际遇和机缘。", "时政"],
    ["越是艰难越向前。", "时政"],
    ["功成不必在我，功成必定有我。", "时政"],
    ["征途漫漫，惟有奋斗。", "时政"],
    ["想，都是问题；做，才是答案。", "备考"],
    ["今天背不下来的书，明天会以分数的形式还给你。", "备考"]
  ];

  function renderQuote() {
    const d = new Date();
    const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / DAY);
    const q = QUOTES[day % QUOTES.length];
    $("#quote-text").textContent = q[0];
    $("#quote-src").textContent = "— " + q[1];
  }

  /* ---------------- 倒计时 / 首页 ---------------- */
  function examInfo() {
    const exam = parseDate(S.settings.exam);
    const start = parseDate(S.settings.start);
    const now = new Date();
    const days = Math.ceil((exam - now) / DAY);
    const total = Math.max(1, Math.ceil((exam - start) / DAY));
    const used = Math.max(0, total - days);
    return { days, pct: Math.min(100, Math.max(0, (used / total) * 100)), exam, start };
  }

  function computeStreak() {
    const days = S.stats.days || {};
    let n = 0;
    let d = new Date();
    if (!days[iso(d)]) d = yesterday(d);       // 今天还没学，允许从昨天算
    while (days[iso(d)]) { n++; d = yesterday(d); }
    S.stats.streak = n;
    return n;
  }

  const deckStats = () => {
    const now = Date.now();
    const out = { "全部": 0, "语文": 0, "政治": 0 };
    S.cards.forEach((c) => {
      if (c.due <= now) { out["全部"]++; if (out[c.deck] != null) out[c.deck]++; }
    });
    return out;
  };

  function renderHome() {
    const { days, pct, exam } = examInfo();
    $("#cd-days").textContent = days >= 0 ? days : 0;
    $("#home-exam-date").textContent = S.settings.exam + (S.settings.target ? " · " + S.settings.target : "");
    $("#cd-sub").textContent = days >= 0 ? exam.getFullYear() + " 年考试 · 总分 300（语文 150 + 政治 150）" : "考试日期已过，请到设置里更新";
    $("#cd-progress").style.width = pct.toFixed(1) + "%";

    const doneToday = (S.stats.days || {})[todayKey()] || 0;
    const goal = S.settings.goal || 30;
    $("#cd-note").textContent = "今日已复习 " + doneToday + " 张 / 目标 " + goal + " 张" +
      (doneToday >= goal ? " · 达标 ✓" : " · 还差 " + (goal - doneToday) + " 张");

    const ds = deckStats();
    $("#home-due").textContent = ds["全部"];
    const unmastered = S.wrongs.filter((w) => !(w.streak >= 3)).length;
    $("#home-wrong").textContent = unmastered;
    $("#home-reviewed").textContent = doneToday;
    const wk = S.tasks.filter((t) => t.week === 0);
    $("#home-task").textContent = wk.filter((t) => t.done).length + "/" + wk.length;
    const exs = examStats();
    $("#home-exam").textContent = exs.avg != null ? exs.avg : "—";

    // 今天做什么
    const todo = [];
    if (ds["全部"] > 0) todo.push({ text: "背完今日到期卡片 " + ds["全部"] + " 张", go: "cards", done: false });
    if (unmastered > 0) todo.push({ text: "复习未掌握错题 " + unmastered + " 道", go: "wrongs", done: false });
    wk.filter((t) => !t.done).slice(0, 3).forEach((t) => todo.push({ text: t.text, go: "plan", done: false }));
    if (!todo.length) todo.push({ text: "今天任务已清空，可以多做一套真题或让 AI 造新卡", go: "cards", done: true });
    $("#home-todo").innerHTML = todo.map((t) =>
      '<div class="li' + (t.done ? " done" : "") + '" data-go="' + t.go + '"><span class="dot">' +
      (t.done ? "✓" : "") + "</span><span class=\"txt\">" + esc(t.text) + "</span></div>").join("");

    // 里程碑
    const ms = [
      { d: "2027-09-01", t: "入学 · 进信息工程系，找大赛集训队老师" },
      { d: "2028-06-01", t: "大一结束 · 确认专业对应目录，定目标院校" },
      { d: "2029-06-01", t: "大二结束 · 争取自治区赛奖项（免试/加分）" },
      { d: "2030-03-06", t: "网上报名（约 3 月上旬，6 个志愿）" },
      { d: "2030-04-10", t: "考试：上午语文，下午政治" }
    ];
    $("#milestones").innerHTML = ms.map((m) => {
      const left = Math.ceil((parseDate(m.d) - new Date()) / DAY);
      const st = left < 0 ? "已过" : left === 0 ? "就在今天" : "还有 " + left + " 天";
      return '<div class="li"><span class="dot">·</span><span class="txt">' +
        esc(m.d + "  " + m.t) + '<br><small style="color:var(--dim)">' + st + "</small></span></div>";
    }).join("");

    renderQuote();
    computeStreak();
    $("#streak-num").textContent = S.stats.streak || 0;
  }

  /* ---------------- 背诵 ---------------- */
  let curDeck = "全部";
  let curTag = "全部";
  let quizMode = true;                      // true=选择题，false=翻卡自评
  let queue = [];
  let current = null;

  function buildQueue() {
    const now = Date.now();
    queue = S.cards.filter((c) => c.due <= now &&
      (curDeck === "全部" || c.deck === curDeck) &&
      (curTag === "全部" || c.tag === curTag))
      .sort((a, b) => a.due - b.due);
  }

  function renderCards() {
    const ds = deckStats();
    $("#cards-sub").textContent = "待复习 " + ds["全部"] + " 张 · 今日已完成 " + ((S.stats.days || {})[todayKey()] || 0) + " 张";
    $("#deck-chips").innerHTML = ["全部", "语文", "政治"].map((d) =>
      '<button class="chip' + (d === curDeck ? " on" : "") + '" data-deck="' + d + '">' + d +
      (d === "全部" ? " " + ds["全部"] : " " + (ds[d] || 0)) + "</button>").join("");
    $$("#deck-chips .chip").forEach((b) => b.onclick = () => {
      curDeck = b.dataset.deck; curTag = "全部"; renderCards();
    });

    const tags = [];
    S.cards.forEach((c) => {
      if (curDeck !== "全部" && c.deck !== curDeck) return;
      if (c.tag && tags.indexOf(c.tag) < 0) tags.push(c.tag);
    });
    $("#tag-chips").innerHTML = ["全部"].concat(tags).map((t) =>
      '<button class="chip' + (t === curTag ? " on" : "") + '" data-tag="' + esc(t) + '">' + esc(t) + "</button>").join("");
    $$("#tag-chips .chip").forEach((b) => b.onclick = () => { curTag = b.dataset.tag; renderCards(); });

    buildQueue();
    if (!queue.length) {
      current = null;
      $("#flash-card").style.display = "none";
      $("#cards-empty").hidden = false;
      return;
    }
    $("#flash-card").style.display = "";
    $("#cards-empty").hidden = true;
    current = queue[0];
    $("#flash-front").textContent = current.front;
    $("#flash-back").textContent = current.back;
    $("#flash-back").hidden = true;
    $("#btn-next").hidden = true;
    $("#btn-mode").textContent = quizMode ? "切换为卡片模式（翻面自评）" : "切换为选择题模式";

    if (quizMode) {
      $("#btn-reveal").hidden = true;
      $("#srs-btns").hidden = true;
      renderOptions(current);
    } else {
      $("#quiz-opts").hidden = true;
      $("#quiz-opts").innerHTML = "";
      $("#btn-reveal").hidden = false;
      $("#srs-btns").hidden = true;
    }
  }

  /* 用同章节其他卡片的答案做干扰项，无需 AI 也有 ABCD */
  function buildOptions(card) {
    const pool = S.cards.filter((c) =>
      c.id !== card.id && c.back && c.back !== card.back &&
      (c.tag === card.tag || c.deck === card.deck));
    const sameTag = pool.filter((c) => c.tag === card.tag);
    const src = (sameTag.length >= 3 ? sameTag : pool).slice();
    for (let i = src.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = src[i]; src[i] = src[j]; src[j] = t;
    }
    const picked = [];
    src.forEach((c) => { if (picked.length < 3 && picked.indexOf(c.back) < 0) picked.push(c.back); });
    const opts = picked.concat([card.back]);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }
    return opts;
  }

  function renderOptions(card) {
    const opts = buildOptions(card);
    const letters = ["A", "B", "C", "D"];
    const box = $("#quiz-opts");
    box.innerHTML = opts.map((o, i) =>
      '<button class="opt" data-opt="' + i + '"><b>' + letters[i] + "</b>" + esc(o) + "</button>").join("");
    box.hidden = false;

    box.onclick = (e) => {
      const b = e.target.closest("button[data-opt]");
      if (!b || b.disabled) return;
      const idx = +b.dataset.opt;
      const ok = opts[idx] === card.back;
      $$("#quiz-opts .opt").forEach((el, i) => {
        el.disabled = true;
        if (opts[i] === card.back) el.classList.add("right");
        else if (i === idx) el.classList.add("wrong");
      });
      if (!ok) { $("#flash-back").hidden = false; }
      gradeCard(card, ok ? 2 : 0);
      bumpQuiz(card.tag || card.deck, ok);
      if (!ok) addWrongFromCard(card, opts, idx);
      const tk = todayKey();
      $("#cards-sub").textContent = "待复习 " + deckStats()["全部"] + " 张 · 今日已完成 " + (S.stats.days[tk] || 0) + " 张";
      $("#btn-next").hidden = false;
      toast(ok ? "答对了 ✓" : "答错了，正确答案已标出");
    };
  }

  $("#btn-next").onclick = () => { buildQueue(); renderCards(); };

  $("#btn-mode").onclick = () => { quizMode = !quizMode; renderCards(); };

  /* ---------------- 章节正确率 ---------------- */
  function bumpQuiz(key, ok) {
    S.stats.quiz = S.stats.quiz || {};
    const row = S.stats.quiz[key] = S.stats.quiz[key] || { right: 0, wrong: 0 };
    if (ok) row.right++; else row.wrong++;
    save();
  }

  function openStatsSheet() {
    const q = S.stats.quiz || {};
    const keys = Object.keys(q).filter((k) => q[k].right + q[k].wrong > 0);
    if (!keys.length) { sheet("章节正确率", '<p class="tip">还没有答题记录。去背诵页做几道选择题，这里就会出现各章节正确率。</p>'); return; }
    let tr = 0, tw = 0;
    keys.forEach((k) => { tr += q[k].right; tw += q[k].wrong; });
    const rows = keys.map((k) => {
      const r = q[k].right, w = q[k].wrong, n = r + w;
      return { k, n, pct: Math.round((r / n) * 100) };
    }).sort((a, b) => a.pct - b.pct);
    const html = '<p class="tip">累计 ' + (tr + tw) + ' 题，总正确率 ' + Math.round((tr / (tr + tw)) * 100) +
      '%。按薄弱程度从低到高排，最上面就是最该补的章节。</p>' +
      rows.map((r) => '<div class="statrow"><span class="nm">' + esc(r.k) + '</span>' +
        '<span class="track"><i style="width:' + r.pct + '%;background:' +
        (r.pct < 60 ? "var(--bad)" : r.pct < 80 ? "var(--warn)" : "var(--acc2)") + '"></i></span>' +
        '<span class="val">' + r.pct + '% · ' + r.n + '题</span></div>').join("") +
      '<p class="tip">低于 60% 的章节建议切到「翻卡自评」逐条背一遍，再回来做选择题。</p>';
    sheet("章节正确率", html);
  }
  $("#btn-stats").onclick = openStatsSheet;

  /* 答错自动进错题本 */
  function addWrongFromCard(card, opts, chosenIdx) {
    const letters = ["A", "B", "C", "D"];
    const topic = card.tag || "未分类";
    // 同一张卡不重复入库
    if (S.wrongs.some((w) => w.fromCard === card.id || (w.stem === card.front && w.topic === topic))) return;
    const rightIdx = opts.indexOf(card.back);
    S.wrongs.push({
      id: "w" + Date.now(),
      subject: card.deck, topic,
      stem: card.front,
      options: opts.map((o, i) => letters[i] + ". " + o),
      answer: letters[rightIdx] || "",
      myAnswer: letters[chosenIdx] || "",
      explanation: "正确答案：" + card.back,
      streak: 0, createdAt: Date.now(), fromCard: card.id
    });
    save();
    toast("已自动加入错题本");
  }

  /* ---------------- 错题按章重练 ---------------- */
  function openDrillSheet() {
    const pend = S.wrongs.filter((w) => w.streak < 3 && w.options && w.options.length);
    if (!pend.length) {
      sheet("按章重练", '<p class="tip">暂无可用错题。自动收录的错题自带选项；手动录题时把选项填上也能参与重练。</p>');
      return;
    }
    const map = {};
    pend.forEach((w) => { const t = w.topic || "未分类"; map[t] = (map[t] || 0) + 1; });
    sheet("按章重练", '<div class="form"><p class="tip">答对 3 次算掌握，答错清零重来。</p>' +
      '<button class="primary" data-drill="__all">全部（' + pend.length + ' 题）</button>' +
      Object.keys(map).map((t) =>
        '<button class="ghost" data-drill="' + esc(t) + '">' + esc(t) + '（' + map[t] + ' 题）</button>').join("") +
      "</div>");
    $$("[data-drill]").forEach((b) => b.onclick = () => startDrill(b.dataset.drill));
  }

  function startDrill(tag) {
    const list = S.wrongs.filter((w) => w.streak < 3 && w.options && w.options.length &&
      (tag === "__all" || (w.topic || "未分类") === tag));
    if (!list.length) return toast("没有题目");
    let i = 0, right = 0;
    const letters = ["A", "B", "C", "D"];
    const step = () => {
      if (i >= list.length) {
        sheet("重练完成", '<div class="form" style="text-align:center">' +
          '<p class="tip">本轮 ' + list.length + ' 题，答对 ' + right + ' 题</p>' +
          '<button class="primary" id="drill-close">关闭</button></div>');
        $("#drill-close").onclick = () => { closeSheet(); renderWrongs(); };
        return;
      }
      const w = list[i];
      const opts = w.options.map((o, idx) => {
        const t = String(o).trim();
        const letter = /^[A-D]/.test(t) ? t.charAt(0) : letters[idx];
        const text = t.replace(/^[A-D][.、．]\s*/, "");
        return { letter, text };
      });
      const ans = String(w.answer || "").trim().toUpperCase();
      sheet("重练 " + (i + 1) + "/" + list.length + " · " + (w.topic || "未分类"),
        '<div class="form"><div class="wstem">' + esc(w.stem) + '</div>' +
        '<div id="drill-opts"></div><div id="drill-fb"></div></div>');
      $("#drill-opts").innerHTML = opts.map((o) =>
        '<button class="opt" data-l="' + o.letter + '"><b>' + o.letter + "</b>" + esc(o.text) + "</button>").join("");
      $$("#drill-opts .opt").forEach((b) => b.onclick = () => {
        const ok = b.dataset.l === ans;
        $$("#drill-opts .opt").forEach((x) => {
          x.disabled = true;
          if (x.dataset.l === ans) x.classList.add("right");
          else if (x === b) x.classList.add("wrong");
        });
        w.streak = ok ? (w.streak || 0) + 1 : 0;
        w.lastAt = Date.now();
        if (ok) right++;
        save();
        $("#drill-fb").innerHTML = '<p class="tip">' + (ok ? "答对了" : "答错了") +
          " · 这道题已对 " + w.streak + "/3 次" + (w.streak >= 3 ? "（已掌握）" : "") + "</p>" +
          '<button class="primary wide" id="drill-next">' + (i + 1 >= list.length ? "查看结果" : "下一题") + "</button>";
        $("#drill-next").onclick = () => { i++; step(); };
      });
    };
    step();
  }
  $("#btn-drill").onclick = openDrillSheet;

  $("#btn-reveal").onclick = () => {
    if (!current) return;
    $("#flash-back").hidden = false;
    $("#btn-reveal").hidden = true;
    $("#srs-btns").hidden = false;
  };

  function gradeCard(c, q) {
    let interval;
    if (q === 0) { c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); interval = 0.007; }
    else if (q === 1) { c.ease = Math.max(1.3, c.ease - 0.05); interval = c.reps ? Math.max(1, c.interval * 1.2) : 1; }
    else if (q === 2) { interval = c.reps ? Math.max(1, c.interval * c.ease) : 3; }
    else { c.ease = Math.min(3.2, c.ease + 0.1); interval = c.reps ? Math.max(3, c.interval * c.ease * 1.3) : 7; }
    c.interval = Math.round(interval * 100) / 100;
    c.due = Date.now() + interval * DAY;
    c.reps++;
    const tk = todayKey();
    S.stats.days[tk] = (S.stats.days[tk] || 0) + 1;
    S.stats.last = tk;
    save();
  }

  $("#srs-btns").onclick = (e) => {
    const btn = e.target.closest("button[data-q]");
    if (!btn || !current) return;
    const tk0 = current;
    gradeCard(tk0, +btn.dataset.q);
    buildQueue();
    renderCards();
    $("#cards-sub").textContent = "待复习 " + deckStats()["全部"] + " 张 · 今日已完成 " + (S.stats.days[todayKey()] || 0) + " 张";
  };

  $("#btn-add-card").onclick = () => {
    sheet("新建卡片", '<div class="form">' +
      '<label>卡组<select id="nc-deck"><option>语文</option><option>政治</option></select></label>' +
      '<label>标签<input id="nc-tag" placeholder="如：默写 / 马原 / 实词"></label>' +
      '<label>正面（问题）<textarea id="nc-front" placeholder="例：《劝学》：不积跬步，无以至千里？"></textarea></label>' +
      '<label>背面（答案）<textarea id="nc-back"></textarea></label>' +
      '<button class="primary" id="nc-save">保存</button></div>');
    $("#nc-save").onclick = () => {
      const front = $("#nc-front").value.trim(), back = $("#nc-back").value.trim();
      if (!front || !back) return toast("正反面都要填");
      S.cards.push({
        id: "c" + Date.now(), deck: $("#nc-deck").value, tag: $("#nc-tag").value.trim(),
        front, back, due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0
      });
      save(); closeSheet(); renderCards(); toast("已添加");
    };
  };

  $("#btn-card-list").onclick = () => {
    const rows = S.cards.map((c, i) =>
      '<div class="li"><span class="dot">' + (i + 1) + '</span><span class="txt">' +
      '<b style="font-size:13px">' + esc(c.deck) + " · " + esc(c.tag || "无标签") + "</b><br>" +
      esc(c.front.slice(0, 40)) + (c.front.length > 40 ? "…" : "") +
      '<br><small style="color:var(--dim)">下次复习：' + (c.due <= Date.now() ? "现在" : new Date(c.due).toLocaleDateString()) +
      " · 复习 " + c.reps + " 次</small>" +
      ' <button class="ghost" style="padding:4px 10px;font-size:11px;margin-top:6px" data-del="' + c.id + '">删除</button>' +
      "</span></div>").join("");
    sheet("卡片列表（" + S.cards.length + "）", rows || "<p class='tip'>还没有卡片</p>");
    $$("[data-del]").forEach((b) => b.onclick = () => {
      S.cards = S.cards.filter((c) => c.id !== b.dataset.del);
      save(); closeSheet(); renderCards(); toast("已删除");
    });
  };

  /* ---------------- 错题 ---------------- */
  let wrongFilter = "全部";
  let wrongSort = "new";

  function renderWrongs() {
    const un = S.wrongs.filter((w) => w.streak < 3).length;
    $("#wrongs-sub").textContent = "未掌握 " + un + " / 共 " + S.wrongs.length + " 道";
    $("#wrong-chips").innerHTML = ["全部", "语文", "政治", "已掌握"].map((f) =>
      '<button class="chip' + (f === wrongFilter ? " on" : "") + '" data-f="' + f + '">' + f + "</button>").join("");
    $$("#wrong-chips .chip").forEach((b) => b.onclick = () => { wrongFilter = b.dataset.f; renderWrongs(); });

    let list = S.wrongs.slice().reverse();
    if (wrongFilter === "语文" || wrongFilter === "政治") list = list.filter((w) => w.subject === wrongFilter);
    if (wrongFilter === "已掌握") list = list.filter((w) => w.streak >= 3);

    const sorts = [["new", "最新加入"], ["stale", "最久未练"], ["weak", "掌握最差"]];
    $("#wrong-sort").innerHTML = sorts.map((x) =>
      '<button class="chip' + (x[0] === wrongSort ? " on" : "") + '" data-sort="' + x[0] + '">' + x[1] + "</button>").join("");
    $$("#wrong-sort .chip").forEach((b) => b.onclick = () => { wrongSort = b.dataset.sort; renderWrongs(); });

    if (wrongSort === "stale") list.sort((a, b) => (a.lastAt || a.createdAt || 0) - (b.lastAt || b.createdAt || 0));
    else if (wrongSort === "weak") list.sort((a, b) => (a.streak || 0) - (b.streak || 0));
    else list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    $("#wrong-list").innerHTML = list.length ? list.map((w) => {
      const ans = (w.answer || "").trim();
      const opts = (w.options || []).map((o) => {
        const label = o.trim().charAt(0).toUpperCase();
        let isRight = false;
        if (ans) {
          isRight = /^[A-Da-d]$/.test(ans) ? label === ans.toUpperCase()
                                           : o.trim().startsWith(ans);
        }
        return '<div class="wopt' + (isRight ? " right" : "") + '">' + esc(o) + "</div>";
      }).join("");
      return '<div class="wcard">' +
        '<div class="wmeta"><span class="tag">' + esc(w.subject) + "</span>" +
        (w.topic ? '<span class="tag">' + esc(w.topic) + "</span>" : "") +
        '<span class="tag ' + (w.streak >= 3 ? "ok" : "bad") + '">' +
        (w.streak >= 3 ? "已掌握" : "对 " + w.streak + "/3") + "</span></div>" +
        '<div class="wstem">' + esc(w.stem) + "</div>" + opts +
        '<div class="wans">答案：' + esc(w.answer) + (w.myAnswer ? " · 我当时选 " + esc(w.myAnswer) : "") +
        (w.explanation ? "<br><br>" + esc(w.explanation) : "") + "</div>" +
        '<div class="wbtns">' +
        '<button data-ok="' + w.id + '">答对了 +1</button>' +
        '<button data-ai="' + w.id + '" class="ai">AI 讲解</button>' +
        '<button data-rm="' + w.id + '">删除</button></div></div>';
    }).join("") : "<p class='tip'>还没有错题。点右上角「＋ 录题」把真题错题录进来。</p>";

    $$("[data-ok]").forEach((b) => b.onclick = () => {
      const w = S.wrongs.find((x) => x.id === b.dataset.ok);
      if (!w) return;
      w.streak = (w.streak || 0) + 1; w.lastAt = Date.now(); save(); renderWrongs();
      toast(w.streak >= 3 ? "已掌握 ✓" : "再答对 " + (3 - w.streak) + " 次就算掌握");
    });
    $$("[data-rm]").forEach((b) => b.onclick = () => {
      S.wrongs = S.wrongs.filter((x) => x.id !== b.dataset.rm); save(); renderWrongs();
    });
    $$("[data-ai]").forEach((b) => b.onclick = () => aiExplain(b.dataset.ai));
  }

  $("#btn-add-wrong").onclick = () => {
    sheet("录一道错题", '<div class="form">' +
      '<label>科目<select id="nw-sub"><option>语文</option><option>政治</option></select></label>' +
      '<label>知识点<input id="nw-topic" placeholder="如：病句辨析 / 马原·矛盾"></label>' +
      '<label>题干<textarea id="nw-stem"></textarea></label>' +
      '<label>选项（每行一个，可不填）<textarea id="nw-opts" placeholder="A. …&#10;B. …"></textarea></label>' +
      '<label>正确答案<input id="nw-ans" placeholder="如 B"></label>' +
      '<label>我当时的答案<input id="nw-my" placeholder="如 A（可不填）"></label>' +
      '<label>解析<input id="nw-exp" placeholder="可不填，之后可用 AI 生成"></label>' +
      '<button class="primary" id="nw-save">保存</button></div>');
    $("#nw-save").onclick = () => {
      const stem = $("#nw-stem").value.trim();
      if (!stem) return toast("题干不能为空");
      S.wrongs.push({
        id: "w" + Date.now(), subject: $("#nw-sub").value, topic: $("#nw-topic").value.trim(),
        stem, options: $("#nw-opts").value.split("\n").map((s) => s.trim()).filter(Boolean),
        answer: $("#nw-ans").value.trim(), myAnswer: $("#nw-my").value.trim(),
        explanation: $("#nw-exp").value.trim(), streak: 0, createdAt: Date.now()
      });
      save(); closeSheet(); renderWrongs(); toast("已加入错题本");
    };
  };

  /* ---------------- 模拟考计时 ---------------- */
  let examTimer = null;

  function examStats() {
    const list = S.exams || [];
    const avg = list.length ? Math.round(list.reduce((a, b) => a + (+b.score || 0), 0) / list.length) : null;
    return { list, avg };
  }

  function openExamSheet() {
    const { list, avg } = examStats();
    const recent = list.slice(-5).reverse().map((e) =>
      '<div class="li"><span class="dot">·</span><span class="txt">' +
      esc(e.date + " " + e.subject + "  " + e.score + "/" + (e.total || 150) +
        "（用时 " + e.used + " 分）") + "</span></div>").join("");
    sheet("模拟考", '<div class="form">' +
      '<p class="tip">整卷限时：语文 120 分钟、政治 120 分钟（与真实考试一致）。' +
      (avg != null ? " 目前平均 " + avg + " / 150。" : "") + "</p>" +
      '<button class="primary" data-exam="语文">语文 120 分钟</button>' +
      '<button class="primary" data-exam="政治">政治 120 分钟</button>' +
      '<button class="ghost" data-exam="自定义">自定义时长</button>' +
      (recent ? '<h2 class="sec" style="margin-top:8px">最近记录</h2>' + recent : "") +
      "</div>");
    $$("[data-exam]").forEach((b) => b.onclick = () => {
      if (b.dataset.exam === "自定义") {
        sheet("自定义时长", '<div class="form"><label>分钟数<input id="exam-min" type="number" value="90" min="5" max="300"></label>' +
          '<button class="primary" id="exam-min-go">开始</button></div>');
        $("#exam-min-go").onclick = () => {
          const m = Math.max(5, Math.min(300, parseInt($("#exam-min").value, 10) || 90));
          startExam("自选", m);
        };
      } else {
        startExam(b.dataset.exam, 120);
      }
    });
  }

  function startExam(subject, minutes) {
    clearInterval(examTimer);
    const totalSec = minutes * 60;
    let left = totalSec;
    const render = () => {
      const m = Math.floor(left / 60), s = left % 60;
      $("#exam-clock").textContent = pad(m) + ":" + pad(s);
      $("#exam-clock").style.color = left <= 300 ? "var(--bad)" : "var(--acc)";
    };
    sheet("模拟考 · " + subject, '<div class="form" style="text-align:center">' +
      '<div id="exam-clock" style="font-size:64px;font-weight:800;letter-spacing:-2px;font-variant-numeric:tabular-nums">' + pad(minutes) + ":00</div>" +
      '<p class="tip" id="exam-hint">交卷前不要退出；退出后计时会停。</p>' +
      '<button class="ghost" id="exam-pause">暂停</button>' +
      '<button class="primary" id="exam-done">交卷并记分</button>' +
      "</div>");
    render();
    examTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(examTimer);
        left = 0; render();
        $("#exam-hint").textContent = "时间到。请交卷记分。";
        return;
      }
      render();
    }, 1000);

    let paused = false;
    $("#exam-pause").onclick = () => {
      paused = !paused;
      if (paused) { clearInterval(examTimer); $("#exam-pause").textContent = "继续"; }
      else {
        $("#exam-pause").textContent = "暂停";
        examTimer = setInterval(() => {
          left--; if (left <= 0) { clearInterval(examTimer); left = 0; render(); return; } render();
        }, 1000);
      }
    };
    $("#exam-done").onclick = () => {
      clearInterval(examTimer);
      $("#exam-done").hidden = true;
      $("#exam-pause").hidden = true;
      const box = document.createElement("div");
      box.className = "form";
      box.style.marginTop = "12px";
      box.innerHTML = '<label>这次得分（满分 150）<input id="exam-score" type="number" value="120" min="0" max="150"></label>' +
        '<button class="primary" id="exam-save">保存记录</button>' +
        '<button class="ghost" id="exam-back">继续考试</button>';
      $("#exam-clock").parentNode.appendChild(box);
      $("#exam-save").onclick = () => {
        const sc = Math.max(0, Math.min(150, parseInt($("#exam-score").value, 10) || 0));
        S.exams.push({
          id: "e" + Date.now(), subject, minutes,
          used: Math.round((totalSec - left) / 60),
          score: sc, total: 150, date: todayKey()
        });
        save(); closeSheet(); renderHome(); toast("已记录");
      };
      $("#exam-back").onclick = () => {
        box.remove();
        $("#exam-done").hidden = false;
        $("#exam-pause").hidden = false;
        examTimer = setInterval(() => {
          left--; if (left <= 0) { clearInterval(examTimer); left = 0; render(); return; } render();
        }, 1000);
      };
    };
  }

  /* ---------------- AI 批改大题 ---------------- */
  function openEssaySheet() {
    const n = (S.essays || []).length;
    sheet("AI 批改大题", '<div class="form">' +
      '<p class="tip">把题目和你写的答案粘进来，AI 按采分点给分并指出失分原因。' +
      (n ? " 已保存 " + n + " 次批改。" : "") + "</p>" +
      '<label>科目<select id="es-sub"><option>政治</option><option>语文</option></select></label>' +
      '<label>题目<textarea id="es-q" placeholder="如：结合材料，说明如何推进生态文明建设。"></textarea></label>' +
      '<label>我的答案<textarea id="es-a" style="min-height:120px"></textarea></label>' +
      '<label>满分<input id="es-full" type="number" value="10" min="1" max="60"></label>' +
      '<button class="primary" id="es-go">开始批改</button>' +
      '<div id="es-out"></div></div>');

    $("#es-go").onclick = async () => {
      const sub = $("#es-sub").value, q = $("#es-q").value.trim();
      const a = $("#es-a").value.trim(), full = +$("#es-full").value || 10;
      if (!q || !a) return toast("题目和答案都要填");
      if (!S.settings.apiKey) {
        $("#es-out").innerHTML = '<p class="tip">未配置 API Key，无法批改。到「设置 → AI」填入即可。</p>';
        return;
      }
      $("#es-out").innerHTML = '<p class="tip"><span class="spin"></span> 批改中…</p>';
      const prompt = "你是新疆专升本《" + sub + "》阅卷老师。题目：" + q +
        "\n考生答案：" + a + "\n满分：" + full + " 分。\n" +
        "请输出四部分，用小标题：【得分】x/" + full +
        " 【采分点】逐条列出应答到的点，标注考生是否答到【失分原因】具体指出【改进示范】给出一份能拿高分的答案（150 字内）。" +
        "评分要严格，按采分点给分，不要给同情分。";
      try {
        const out = await callAI([{ role: "system", content: SYS }, { role: "user", content: prompt }]);
        const m = out.match(/【得分】\s*([0-9.]+)/);
        $("#es-out").innerHTML = '<div class="ai-out">' + esc(out) + "</div>" +
          '<button class="primary wide" id="es-save">存为批改记录</button>';
        $("#es-save").onclick = () => {
          S.essays.push({
            id: "s" + Date.now(), date: todayKey(), subject: sub, question: q,
            answer: a, score: m ? +m[1] : null, full, feedback: out
          });
          save(); closeSheet(); toast("已保存");
        };
      } catch (e) {
        $("#es-out").innerHTML = '<p class="tip">失败：' + esc(e.message) + "</p>";
      }
    };
  }

  $("#tile-exam").onclick = openExamSheet;
  $("#tile-essay").onclick = openEssaySheet;

  /* ---------------- 计划 ---------------- */
  function renderPlan() {
    const wk = S.tasks.filter((t) => t.week === 0);
    const done = wk.filter((t) => t.done).length;
    $("#plan-sub").textContent = "本周完成 " + done + "/" + wk.length;
    $("#plan-box").innerHTML = wk.length ? wk.map((t) =>
      '<div class="li' + (t.done ? " done" : "") + '" data-task="' + t.id + '">' +
      '<span class="dot">' + (t.done ? "✓" : "") + '</span><span class="txt">' + esc(t.text) +
      ' <button class="ghost" style="padding:2px 8px;font-size:11px;margin-left:6px" data-trm="' + t.id + '">×</button>' +
      "</span></div>").join("") : "<p class='tip'>还没有任务，点「AI 排计划」或手动添加。</p>";

    $$("[data-task]").forEach((el) => el.onclick = (e) => {
      if (e.target.dataset.trm) return;
      const t = S.tasks.find((x) => x.id === el.dataset.task);
      if (t) { t.done = !t.done; save(); renderPlan(); }
    });
    $$("[data-trm]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      S.tasks = S.tasks.filter((x) => x.id !== b.dataset.trm); save(); renderPlan();
    });
  }

  $("#btn-add-task").onclick = () => {
    sheet("添加任务", '<div class="form"><label>任务内容<textarea id="nt-text"></textarea></label>' +
      '<button class="primary" id="nt-save">保存</button></div>');
    $("#nt-save").onclick = () => {
      const text = $("#nt-text").value.trim();
      if (!text) return toast("写点什么");
      S.tasks.push({ id: "t" + Date.now(), text, week: 0, done: false });
      save(); closeSheet(); renderPlan(); toast("已添加");
    };
  };

  /* ---------------- 设置 ---------------- */
  function renderSettings() {
    const st = S.settings;
    $("#set-exam").value = st.exam;
    $("#set-target").value = st.target;
    $("#set-score").value = st.targetScore;
    $("#set-goal").value = st.goal;
    $("#set-api-base").value = st.apiBase;
    $("#set-model").value = st.model;
    $("#set-apikey").value = st.apiKey;
    const rm = S.settings.remind || {};
    $("#set-remind").value = rm.time || "20:00";
    $("#remind-state").textContent = rm.on
      ? "已开启：每天 " + (rm.time || "20:00") + " 提醒（首次会弹系统授权，允许即可）"
      : "未开启。开启后每天到点提醒你背卡（需安装 App，网页版不支持系统通知）。";
    $("#app-version").textContent = "版本 1.4 · 卡片 " + S.cards.length + " 张 · 错题 " +
      S.wrongs.length + " 道 · 模考 " + (S.exams || []).length + " 次 · 批改 " + (S.essays || []).length + " 份";
  }

  ["set-exam", "set-target", "set-score", "set-goal", "set-api-base", "set-model", "set-apikey"].forEach((id) => {
    const el = $("#" + id);
    el.addEventListener("change", () => {
      const st = S.settings;
      if (id === "set-exam") st.exam = el.value || st.exam;
      if (id === "set-target") st.target = el.value.trim();
      if (id === "set-score") st.targetScore = +el.value || 250;
      if (id === "set-goal") st.goal = Math.max(1, +el.value || 30);
      if (id === "set-api-base") st.apiBase = el.value.trim().replace(/\/$/, "");
      if (id === "set-model") st.model = el.value.trim();
      if (id === "set-apikey") st.apiKey = el.value.trim();
      save(); toast("已保存");
      if (id === "set-exam" || id === "set-goal") renderHome();
    });
  });

  $("#btn-remind-on").onclick = () => {
    const time = $("#set-remind").value || "20:00";
    S.settings.remind = { on: true, time };
    save();
    const br = (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notify) || null;
    if (br) {
      br.postMessage({ action: "schedule", time,
        title: "今天的卡还没刷", body: "10 分钟就能背完今天的量，别断在第一天。" });
      toast("已开启，每天 " + time + " 提醒");
    } else {
      toast("已记录设置；系统通知需安装 App 版才生效");
    }
    renderSettings();
  };

  $("#btn-remind-off").onclick = () => {
    S.settings.remind = { on: false, time: ($("#set-remind").value || "20:00") };
    save();
    const br = (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.notify) || null;
    if (br) br.postMessage({ action: "cancel" });
    toast("已关闭提醒");
    renderSettings();
  };

  $("#btn-export").onclick = () => {
    const data = JSON.stringify(S);
    sheet("导出备份", '<p class="tip">长按下面文本 → 全选 → 拷贝，粘贴到备忘录或文件 App 保存。</p>' +
      '<textarea style="min-height:220px" readonly>' + esc(data) + "</textarea>");
  };

  $("#btn-import").onclick = () => {
    sheet("导入备份", '<div class="form"><label>把之前导出的 JSON 粘贴到这里' +
      '<textarea id="imp-text" style="min-height:200px"></textarea></label>' +
      '<button class="primary" id="imp-go">导入（覆盖当前数据）</button></div>');
    $("#imp-go").onclick = () => {
      try {
        const obj = JSON.parse($("#imp-text").value);
        if (!obj || !obj.settings) throw new Error("格式不对");
        S = Object.assign(defaults(), obj); save(); closeSheet(); go("home"); toast("导入成功");
      } catch (e) { toast("导入失败：" + e.message); }
    };
  };

  $("#btn-reset").onclick = () => {
    sheet("确认清空？", '<p class="tip">会删除全部卡片、错题和记录，无法恢复。建议先导出备份。</p>' +
      '<button class="ghost danger wide" id="rs-go">确认清空</button>');
    $("#rs-go").onclick = () => {
      localStorage.removeItem(KEY); S = seed(defaults()); save(); closeSheet(); go("home"); toast("已重置");
    };
  };

  /* ---------------- AI ---------------- */
  async function callAI(messages) {
    const { apiBase, apiKey, model } = S.settings;
    if (!apiKey) throw new Error("NO_KEY");
    const url = apiBase.replace(/\/$/, "") + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({ model: model || "deepseek-chat", messages, temperature: 0.6 })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error("接口返回 " + res.status + "：" + txt.slice(0, 160));
    }
    const data = await res.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message &&
      data.choices[0].message.content;
    if (!content) throw new Error("接口没有返回内容");
    return content.trim();
  }

  function extractJSON(text) {
    let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = t.indexOf("["), b = t.lastIndexOf("]");
    const oa = t.indexOf("{"), ob = t.lastIndexOf("}");
    let slice = t;
    if (a >= 0 && b > a) slice = t.slice(a, b + 1);
    else if (oa >= 0 && ob > oa) slice = t.slice(oa, ob + 1);
    return JSON.parse(slice);
  }

  const SYS = "你是新疆维吾尔自治区统招专升本（只考《语文》《政治》，各150分）的备考助教。" +
    "回答必须准确、具体、面向大专学生，不要空话。";

  async function aiExplain(id) {
    const w = S.wrongs.find((x) => x.id === id);
    if (!w) return;
    if (!S.settings.apiKey) {
      return sheet("讲解（离线）", '<div class="ai-out">' + esc(w.explanation || "还没有解析。请到设置里填 API Key 后，这里的「AI 讲解」会生成：知识点定位、错误原因、同类题思路、一句话记忆点。") + "</div>");
    }
    sheet("AI 讲解", '<div class="ai-out"><span class="spin"></span> 正在生成…</div>');
    const prompt = "下面是专升本一道错题，请输出四段，用小标题：\n" +
      "【考点】【我错在哪】【正确思路】【记住一句话】\n\n科目：" + w.subject +
      "\n知识点：" + (w.topic || "未标") + "\n题干：" + w.stem +
      "\n选项：\n" + (w.options || []).join("\n") +
      "\n正确答案：" + w.answer + "\n我选了：" + (w.myAnswer || "未填") +
      "\n已有解析（可参考可纠正）：" + (w.explanation || "无");
    try {
      const out = await callAI([{ role: "system", content: SYS }, { role: "user", content: prompt }]);
      sheet("AI 讲解", '<div class="ai-out">' + esc(out) + "</div>" +
        '<button class="primary wide" id="ai-save-exp">存为这道题的解析</button>');
      $("#ai-save-exp").onclick = () => { w.explanation = out; save(); closeSheet(); renderWrongs(); toast("已保存解析"); };
    } catch (e) {
      sheet("AI 讲解", '<div class="ai-out">调用失败：' + esc(e.message) + "</div>");
    }
  }

  $("#btn-ai-cards").onclick = () => {
    sheet("AI 造卡", '<div class="form">' +
      '<label>科目<select id="ac-deck"><option>语文</option><option>政治</option></select></label>' +
      '<label>主题/知识点<input id="ac-topic" placeholder="如：陈情表默写 / 新发展理念"></label>' +
      '<label>数量<input id="ac-n" type="number" value="5" min="3" max="10"></label>' +
      '<button class="primary" id="ac-go">生成</button><div id="ac-out"></div></div>');
    $("#ac-go").onclick = async () => {
      const deck = $("#ac-deck").value, topic = $("#ac-topic").value.trim(), n = +$("#ac-n").value || 5;
      if (!topic) return toast("写个主题");
      if (!S.settings.apiKey) {
        $("#ac-out").innerHTML = '<p class="tip">未配置 API Key。到「设置 → AI」填入 DeepSeek 等兼容接口的 Key 后即可自动生成。</p>';
        return;
      }
      $("#ac-out").innerHTML = '<p class="tip"><span class="spin"></span> 生成中…</p>';
      const prompt = "为专升本《" + deck + "》生成 " + n + " 张背诵卡，主题：" + topic +
        "。只输出 JSON 数组，元素格式 {\"front\":\"问题\",\"back\":\"答案\",\"tag\":\"标签\"}，" +
        "不要任何解释文字。front 要简短可背，back 要准确完整。";
      try {
        const txt = await callAI([{ role: "system", content: SYS }, { role: "user", content: prompt }]);
        const arr = extractJSON(txt);
        if (!Array.isArray(arr) || !arr.length) throw new Error("返回格式不是数组");
        $("#ac-out").innerHTML = arr.map((c, i) =>
          '<div class="li"><span class="dot">' + (i + 1) + '</span><span class="txt"><b>' +
          esc(c.front) + "</b><br><small style=\"color:var(--dim)\">" + esc(c.back) + "</small></span></div>").join("") +
          '<button class="primary wide" id="ac-save">全部加入卡组</button>';
        $("#ac-save").onclick = () => {
          arr.forEach((c, i) => S.cards.push({
            id: "c" + Date.now() + "_" + i, deck, tag: c.tag || topic,
            front: c.front, back: c.back, due: Date.now(), interval: 0, ease: 2.5, reps: 0, lapses: 0
          }));
          save(); closeSheet(); renderCards(); toast("已加入 " + arr.length + " 张");
        };
      } catch (e) {
        $("#ac-out").innerHTML = '<p class="tip">失败：' + esc(e.message) + "</p>";
      }
    };
  };

  $("#btn-ai-plan").onclick = () => {
    sheet("AI 排计划", '<div class="form">' +
      '<label>这周能投入的时间（小时）<input id="ap-h" type="number" value="10"></label>' +
      '<label>当前最弱的地方<input id="ap-weak" placeholder="如：文言文虚词 / 政治大题"></label>' +
      '<button class="primary" id="ap-go">生成 5 条任务</button><div id="ap-out"></div></div>');
    $("#ap-go").onclick = async () => {
      const h = $("#ap-h").value, weak = $("#ap-weak").value.trim();
      if (!S.settings.apiKey) {
        $("#ap-out").innerHTML = '<p class="tip">未配置 API Key。可先手动添加任务。</p>';
        return;
      }
      $("#ap-out").innerHTML = '<p class="tip"><span class="spin"></span> 生成中…</p>';
      const prompt = "新疆专升本（语文150+政治150）备考，每周可用 " + h + " 小时，薄弱点：" + (weak || "无") +
        "。生成 5 条本周任务，只输出 JSON 数组，元素为字符串，每条不超过 40 字，要具体可执行（含篇目/章节/数量）。";
      try {
        const txt = await callAI([{ role: "system", content: SYS }, { role: "user", content: prompt }]);
        const arr = extractJSON(txt);
        if (!Array.isArray(arr)) throw new Error("格式不对");
        $("#ap-out").innerHTML = arr.map((t) => '<div class="li"><span class="dot">·</span><span class="txt">' + esc(t) + "</span></div>").join("") +
          '<button class="primary wide" id="ap-save">加入本周计划</button>';
        $("#ap-save").onclick = () => {
          arr.forEach((t, i) => S.tasks.push({ id: "t" + Date.now() + "_" + i, text: String(t), week: 0, done: false }));
          save(); closeSheet(); renderPlan(); toast("已加入");
        };
      } catch (e) {
        $("#ap-out").innerHTML = '<p class="tip">失败：' + esc(e.message) + "</p>";
      }
    };
  };

  $("#btn-test-ai").onclick = async () => {
    $("#ai-test-result").textContent = "测试中…";
    try {
      const out = await callAI([{ role: "user", content: "只回复两个字：正常" }]);
      $("#ai-test-result").textContent = "连接成功，模型回复：" + out.slice(0, 40);
    } catch (e) {
      $("#ai-test-result").textContent = e.message === "NO_KEY" ? "还没有填 API Key" : "失败：" + e.message;
    }
  };

  /* ---------------- 启动 ---------------- */
  load();
  go("home");

  // 回到前台时刷新倒计时
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && $("#page-home").classList.contains("active")) renderHome();
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
