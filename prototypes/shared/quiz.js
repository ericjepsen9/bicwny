// quiz.html 答题流程
// 依赖 shared/config.js → api.js → require-auth.js 先加载（提供 JX.api / JX.user / JX.sc / JX.util）
//
// 接入：
//   GET  /api/lessons/:id/questions  → PublicQuestion[]
//   POST /api/answers { questionId, answer, timeSpentMs } → { grade, question }
//
// lessonId 取值：URL ?lessonId= > 第一门已发布课程的第一课（兜底）
(function () {
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var lang = window.JX.lang, sc = window.JX.sc, escapeHtml = window.JX.util.escapeHtml;

  var state = {
    questions: [],
    qi: 0,
    confirmed: false,
    lives: 3,
    correctCount: 0,
    wrongCount: 0,
    tStart: Date.now(),
    tQuestionStart: Date.now(),
    answer: null,        // 当前题用户答案（原始结构）
    lastGrade: null,     // 当前题后端返回的 grade
    favoriteIds: {},     // { [questionId]: true } · 本轮题目的收藏态
  };

  // ── 各题型渲染器 ────────────────────────────────────
  var renderers = {};

  renderers.single = function (q, container) {
    var opts = (q.payload && q.payload.options) || [];
    opts.forEach(function (opt, i) {
      var div = document.createElement('div');
      div.className = 'opt' + (state.answer && state.answer.selectedIndex === i ? ' selected' : '');
      div.innerHTML = '<div class="opt-letter">' + LETTERS[i] + '</div>' +
                      '<div class="opt-text">' + escapeHtml(opt.text) + '</div>';
      div.onclick = function () {
        if (state.confirmed) return;
        state.answer = { selectedIndex: i };
        render();
      };
      container.appendChild(div);
    });
  };

  renderers.multi = function (q, container) {
    var opts = (q.payload && q.payload.options) || [];
    var sel = (state.answer && state.answer.selectedIndexes) || [];
    opts.forEach(function (opt, i) {
      var chosen = sel.indexOf(i) >= 0;
      var div = document.createElement('div');
      div.className = 'opt' + (chosen ? ' selected' : '');
      div.innerHTML = '<div class="opt-letter">' + (chosen ? '✓' : LETTERS[i]) + '</div>' +
                      '<div class="opt-text">' + escapeHtml(opt.text) + '</div>';
      div.onclick = function () {
        if (state.confirmed) return;
        var next = ((state.answer && state.answer.selectedIndexes) || []).slice();
        var pos = next.indexOf(i);
        if (pos >= 0) next.splice(pos, 1); else next.push(i);
        state.answer = { selectedIndexes: next };
        render();
      };
      container.appendChild(div);
    });
  };

  // 图像/音频/情境：语义同 single/multi；读取资源后按选项渲染
  renderers.image = function (q, c) {
    var url = q.payload && q.payload.imageUrl;
    if (url) {
      var img = document.createElement('img');
      img.src = url;
      img.alt = q.payload.imageCaption || '';
      img.style.cssText = 'width:100%;border-radius:var(--r-lg);margin-bottom:var(--sp-3);';
      c.appendChild(img);
    }
    renderers.single(q, c);
  };
  renderers.listen = function (q, c) {
    var url = q.payload && q.payload.audioUrl;
    if (url) {
      var au = document.createElement('audio');
      au.src = url; au.controls = true;
      au.style.cssText = 'width:100%;margin-bottom:var(--sp-3);';
      c.appendChild(au);
    }
    renderers.single(q, c);
  };
  renderers.scenario = renderers.multi;

  renderers.fill = function (q, container) {
    var lines = (q.payload && q.payload.verseLines) || [];
    var opts = (q.payload && q.payload.options) || [];
    if (lines.length) {
      var p = document.createElement('div');
      p.style.cssText = 'padding:var(--sp-3);background:var(--saffron-pale);border-radius:var(--r);font-family:var(--font-serif);line-height:2;letter-spacing:2px;margin-bottom:var(--sp-3);';
      p.innerHTML = lines.map(function (ln) { return escapeHtml(ln); }).join('<br>');
      container.appendChild(p);
    }
    opts.forEach(function (text, i) {
      var chosen = state.answer && state.answer.selectedOption === i;
      var div = document.createElement('div');
      div.className = 'opt' + (chosen ? ' selected' : '');
      div.innerHTML = '<div class="opt-letter">' + LETTERS[i] + '</div>' +
                      '<div class="opt-text">' + escapeHtml(text) + '</div>';
      div.onclick = function () {
        if (state.confirmed) return;
        state.answer = { selectedOption: i };
        render();
      };
      container.appendChild(div);
    });
  };

  renderers.open = function (q, container) {
    var ta = document.createElement('textarea');
    ta.className = 'input-field';
    ta.rows = 6;
    ta.style.cssText = 'width:100%;resize:vertical;min-height:120px;';
    ta.value = (state.answer && state.answer.text) || '';
    ta.placeholder = sc('请写下你的理解（至少 20 字）', '請寫下你的理解（至少 20 字）');
    ta.addEventListener('input', function () {
      state.answer = { text: ta.value };
      var btn = document.getElementById('action-btn');
      btn.disabled = state.confirmed ? false : !canSubmit();
    });
    if (state.confirmed) ta.disabled = true;
    container.appendChild(ta);
  };

  // v2 UI 尚未上线，后端已就绪 → 统一占位卡，允许"跳过"
  function placeholder(q, container) {
    var div = document.createElement('div');
    div.style.cssText = 'padding:var(--sp-4);background:var(--glass);border-radius:var(--r-lg);color:var(--ink-3);font:var(--text-caption);line-height:1.7;';
    div.innerHTML = sc(
      '该题型「' + q.type + '」前端尚未上线，后端已就绪。<br>点击「跳过」继续下一题。',
      '該題型「' + q.type + '」前端尚未上線，後端已就緒。<br>點擊「跳過」繼續下一題。',
    );
    container.appendChild(div);
    state.answer = { __placeholder: true };
  }
  ['sort', 'match', 'flip', 'flow', 'guided'].forEach(function (t) {
    renderers[t] = placeholder;
  });

  // ── 提交前校验 ──────────────────────────────────────
  function canSubmit() {
    var q = state.questions[state.qi];
    if (!q || !state.answer) return false;
    switch (q.type) {
      case 'single':
      case 'image':
      case 'listen':   return typeof state.answer.selectedIndex === 'number';
      case 'multi':
      case 'scenario': return (state.answer.selectedIndexes || []).length > 0;
      case 'fill':     return typeof state.answer.selectedOption === 'number';
      case 'open':     return (state.answer.text || '').trim().length >= 20;
      default:         return !!state.answer.__placeholder;
    }
  }

  function typeBadge(type) {
    var m = {
      single: ['单选题', '單選題'], multi: ['多选题', '多選題'],
      fill: ['填空题', '填空題'], open: ['问答题', '問答題'],
      sort: ['排序题', '排序題'], match: ['匹配题', '匹配題'],
      image: ['图识题', '圖識題'], listen: ['听颂题', '聽誦題'],
      scenario: ['情境题', '情境題'], flow: ['流程题', '流程題'],
      guided: ['引导题', '引導題'], flip: ['速记卡', '速記卡'],
    };
    return (m[type] || [type, type])[lang() === 'sc' ? 0 : 1];
  }

  // ── 主渲染 ──────────────────────────────────────────
  function render() {
    var q = state.questions[state.qi];
    var total = state.questions.length;
    if (!q) return;

    document.getElementById('progress-text').textContent = (state.qi + 1) + ' / ' + total;
    document.getElementById('progress-fill').style.width = Math.round((state.qi + 1) / total * 100) + '%';
    document.getElementById('q-num').textContent = 'Q' + (state.qi + 1);
    document.getElementById('q-text').textContent = q.questionText;
    document.querySelector('.q-tag').textContent = typeBadge(q.type);
    document.getElementById('lives-display').textContent =
      '❤'.repeat(state.lives) + (state.lives < 3 ? '♡'.repeat(3 - state.lives) : '');

    // 同步收藏按钮状态（若页面提供了 #q-fav 元素）
    var fav = document.getElementById('q-fav');
    if (fav) {
      fav.classList.toggle('active', !!state.favoriteIds[q.id]);
      fav.setAttribute('data-qid', q.id);
    }

    var ol = document.getElementById('options-list');
    ol.innerHTML = '';
    (renderers[q.type] || placeholder)(q, ol);

    if (state.confirmed) {
      ol.querySelectorAll('.opt').forEach(function (el, i) {
        el.classList.add('disabled');
        el.onclick = null;
        var opts = q.payload && q.payload.options;
        if (q.type === 'single' || q.type === 'image' || q.type === 'listen') {
          if (opts && opts[i] && opts[i].correct) el.classList.add('correct');
          else if (state.answer && state.answer.selectedIndex === i) el.classList.add('wrong');
        } else if (q.type === 'multi' || q.type === 'scenario') {
          var sel = (state.answer && state.answer.selectedIndexes) || [];
          var should = opts && opts[i] && opts[i].correct;
          if (should) el.classList.add('correct');
          else if (sel.indexOf(i) >= 0) el.classList.add('wrong');
        } else if (q.type === 'fill') {
          var correctText = (q.payload && q.payload.correctWord) || '';
          if ((opts || [])[i] === correctText) el.classList.add('correct');
          else if (state.answer && state.answer.selectedOption === i) el.classList.add('wrong');
        }
      });
    }

    var fb = document.getElementById('feedback');
    if (state.confirmed && state.lastGrade) {
      var ok = state.lastGrade.isCorrect;
      fb.className = 'feedback show ' + (ok ? 'correct' : 'wrong');
      document.getElementById('feedback-title').textContent = ok
        ? sc('✓ 回答正确！', '✓ 回答正確！')
        : sc('✗ 回答有误', '✗ 回答有誤') + (state.lastGrade.score ? '（得分 ' + state.lastGrade.score + '）' : '');
      document.getElementById('feedback-body').textContent =
        state.lastGrade.feedback || sc('请参考法本原文', '請參考法本原文');
    } else {
      fb.className = 'feedback';
    }

    var btn = document.getElementById('action-btn');
    if (!state.confirmed) {
      btn.disabled = !canSubmit();
      btn.innerHTML = state.answer && state.answer.__placeholder
        ? sc('跳过', '跳過')
        : sc('确认答案', '確認答案');
      btn.onclick = confirmAnswer;
    } else {
      btn.disabled = false;
      var isLast = state.qi === total - 1;
      btn.innerHTML = isLast ? sc('查看结果', '查看結果') : sc('下一题', '下一題');
      btn.onclick = isLast ? showResult : nextQ;
    }
  }

  function confirmAnswer() {
    if (state.confirmed) return;
    if (!canSubmit()) return;
    var q = state.questions[state.qi];

    // 占位题型 → 不发请求，直接跳
    if (state.answer && state.answer.__placeholder) {
      state.confirmed = true;
      state.lastGrade = { isCorrect: false, score: 0, feedback: sc('已跳过', '已跳過') };
      render();
      return;
    }

    var btn = document.getElementById('action-btn');
    btn.disabled = true;

    var body = {
      questionId: q.id,
      answer: state.answer,
      timeSpentMs: Date.now() - state.tQuestionStart,
    };
    window.JX.api.post('/api/answers', body).then(function (data) {
      state.confirmed = true;
      state.lastGrade = data.grade;
      if (data.grade.isCorrect) state.correctCount++;
      else { state.wrongCount++; state.lives = Math.max(0, state.lives - 1); }
      render();
    }).catch(function (err) {
      btn.disabled = false;
      alert(sc('提交失败：', '提交失敗：') + (err.message || err));
    });
  }

  function nextQ() {
    state.qi++;
    state.confirmed = false;
    state.answer = null;
    state.lastGrade = null;
    state.tQuestionStart = Date.now();
    render();
  }

  // ── 加载题目列表 ───────────────────────────────────
  function resolveLessonId() {
    var fromUrl = window.JX.util.queryParam('lessonId');
    if (fromUrl) return Promise.resolve(fromUrl);
    return window.JX.api.get('/api/courses').then(function (courses) {
      if (!courses || !courses.length) throw new Error(sc('未发布课程', '未發佈課程'));
      return window.JX.api.get('/api/courses/' + encodeURIComponent(courses[0].slug));
    }).then(function (res) {
      var course = res.course || res;
      var ch = (course.chapters || [])[0];
      var lesson = ch && (ch.lessons || [])[0];
      if (!lesson) throw new Error(sc('课程暂无课时', '課程暫無課時'));
      return lesson.id;
    });
  }

  function showEmptyState(message) {
    var body = document.querySelector('.quiz-body');
    body.innerHTML = '<div class="q-card" style="text-align:center;padding:var(--sp-6) var(--sp-5);">' +
      '<p style="font:var(--text-body);color:var(--ink-3);line-height:1.8;">' + escapeHtml(message) + '</p>' +
      '<a href="home.html" class="btn btn-primary btn-pill" style="margin-top:var(--sp-4);display:inline-block;">' +
        sc('返回首页', '返回首頁') + '</a></div>';
    document.querySelector('.quiz-action').style.display = 'none';
  }

  function boot() {
    resolveLessonId().then(function (lessonId) {
      return window.JX.api.get('/api/lessons/' + encodeURIComponent(lessonId) + '/questions?limit=50');
    }).then(function (questions) {
      if (!questions || !questions.length) {
        showEmptyState(sc('本课时暂无题目，敬请期待', '本課時暫無題目，敬請期待'));
        return;
      }
      state.questions = questions;
      state.tStart = Date.now();
      state.tQuestionStart = Date.now();
      render();

      // 预加载本轮题目的收藏态（失败不影响答题）
      window.JX.api.get('/api/favorites?limit=500').then(function (items) {
        (items || []).forEach(function (f) {
          if (f.questionId) state.favoriteIds[f.questionId] = true;
        });
        // 如果当前题已经在收藏列表里，刷新按钮态
        var q = state.questions[state.qi];
        var fb = document.getElementById('q-fav');
        if (q && fb) fb.classList.toggle('active', !!state.favoriteIds[q.id]);
      }).catch(function () {});
    }).catch(function (err) {
      showEmptyState(sc('加载失败：', '加載失敗：') + (err.message || err));
    });
  }

  function showResult() {
    var overlay = document.getElementById('result-overlay');
    overlay.classList.add('show');

    var total = state.questions.length || 1;
    var pct = Math.round(state.correctCount / total * 100);
    var elapsed = Math.round((Date.now() - state.tStart) / 1000);
    var l = lang();

    document.getElementById('ring-pct').textContent = pct + '%';
    document.getElementById('stat-correct').textContent = state.correctCount;
    document.getElementById('stat-wrong').textContent = state.wrongCount;
    document.getElementById('stat-time').textContent = elapsed + 's';

    var titles = {
      sc: ['继续加油，法道漫漫！', '不错，再接再厉！', '殊胜，法喜充满！'],
      tc: ['繼續加油，法道漫漫！', '不錯，再接再厲！', '殊勝，法喜充滿！'],
    };
    document.getElementById('result-title').textContent = titles[l][pct >= 80 ? 2 : pct >= 50 ? 1 : 0];

    var canvas = document.getElementById('ring-canvas');
    var ctx = canvas.getContext('2d');
    var cx = 60, cy = 60, r = 48, lw = 10;
    ctx.clearRect(0, 0, 120, 120);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(43,34,24,.08)'; ctx.lineWidth = lw; ctx.stroke();
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2);
      ctx.strokeStyle = pct >= 80 ? '#A8BC9A' : pct >= 50 ? '#E07856' : '#A13C2E';
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
    }
  }

  // 暴露少量内部对象供后续单测或 desktop 端复用
  window.JX = window.JX || {};
  window.JX.Quiz = { renderers: renderers, state: state };

  // ── 收藏按钮（页面可选提供 #q-fav；点击切换 POST/DELETE /api/favorites/:qid）──
  var favBtn = document.getElementById('q-fav');
  if (favBtn) {
    favBtn.addEventListener('click', function () {
      var q = state.questions[state.qi];
      if (!q || !q.id) return;
      var on = state.favoriteIds[q.id];
      favBtn.setAttribute('aria-busy', 'true');
      var req = on
        ? window.JX.api.del('/api/favorites/' + encodeURIComponent(q.id))
        : window.JX.api.post('/api/favorites/' + encodeURIComponent(q.id), {});
      req.then(function () {
        state.favoriteIds[q.id] = !on;
        favBtn.classList.toggle('active', !on);
      }).catch(function () {
        // 失败静默；收藏非核心路径，不打断答题
      }).finally(function () {
        favBtn.removeAttribute('aria-busy');
      });
    });
  }

  document.addEventListener('langchange', render);
  // require-auth 先跑 /me；完成后再加载题目，确保带上 Bearer token
  document.addEventListener('jx:user-ready', boot);
  // 并发场景：若 /me 已完成或页面重新可见，直接启动
  if (window.JX && window.JX.user) boot();
})();
