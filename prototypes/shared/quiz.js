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
    flipped: false,      // flip 题本张是否已翻面（随 nextQ 重置）
    matchActive: null,   // match 题：当前选中的 left.id（随 nextQ 重置）
    matchRightOrder: null, // match 题：右列展示顺序的 id 列表（shuffle 一次，nextQ 重置）
    flowActive: null,    // flow 题：当前选中的 item text（随 nextQ 重置）
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
  // ── guided（引导分步）· 多步 textarea，整题提交 · 每步 AI 评分 ──
  // payload: { finalQuestion, steps: [{stepNum, prompt, hint?}] }（keyPoints 公开视图剥除）
  // answer : { stepAnswers: { [stepNum: string]: string } }
  // grade.perStep: [{stepNum, score, hits[], missed[]}] — 仅 confirmed 后出现
  renderers.guided = function (q, container) {
    var p = q.payload || {};
    var steps = p.steps || [];
    if (!steps.length) {
      container.appendChild(document.createElement('div'));
      return;
    }
    if (!state.answer || typeof state.answer.stepAnswers !== 'object') {
      state.answer = { stepAnswers: {} };
    }
    var stepAnswers = state.answer.stepAnswers;

    // 最终问题提示（置顶，告诉用户"最终要回答的是什么"）
    if (p.finalQuestion) {
      var fq = document.createElement('div');
      fq.className = 'guided-final';
      fq.innerHTML =
        '<span class="guided-final-label"><span class="sc">最终问题</span><span class="tc">最終問題</span></span>' +
        '<p class="guided-final-text">' + escapeHtml(p.finalQuestion) + '</p>';
      container.appendChild(fq);
    }

    // 每步一个卡片
    steps.forEach(function (s, i) {
      var key = String(s.stepNum);
      var text = stepAnswers[key] || '';
      var step = document.createElement('div');
      step.className = 'guided-step';
      if (state.confirmed) step.classList.add('confirmed');

      // 提交后的分数徽章
      var perStep = (state.lastGrade && state.lastGrade.perStep) || [];
      var result = perStep.find(function (r) { return r.stepNum === s.stepNum; });
      var scoreBadge = '';
      if (state.confirmed && result) {
        var cls = result.score >= 80 ? 'ok' : (result.score >= 60 ? 'mid' : 'bad');
        scoreBadge = '<span class="guided-score guided-score-' + cls + '">' + result.score + '</span>';
      }

      step.innerHTML =
        '<div class="guided-step-head">' +
          '<span class="guided-step-num">' + (i + 1) + '</span>' +
          '<p class="guided-step-prompt">' + escapeHtml(s.prompt) + '</p>' +
          scoreBadge +
        '</div>' +
        (s.hint ? '<p class="guided-step-hint">· ' + escapeHtml(s.hint) + '</p>' : '');

      var ta = document.createElement('textarea');
      ta.className = 'input-field guided-step-input';
      ta.rows = 3;
      ta.placeholder = window.JX.sc('请在此作答…', '請在此作答…');
      ta.value = text;
      if (state.confirmed) ta.disabled = true;
      ta.addEventListener('input', function () {
        stepAnswers[key] = ta.value;
        // 只更新 action-btn 可用状态；不整页 render 避免光标丢失
        var btn = document.getElementById('action-btn');
        btn.disabled = !canSubmit();
      });
      step.appendChild(ta);

      // 提交后附命中 / 遗漏
      if (state.confirmed && result) {
        if (result.hits && result.hits.length) {
          var hitsEl = document.createElement('p');
          hitsEl.className = 'guided-kp guided-hits';
          hitsEl.innerHTML = '<span class="sc">✓ 命中：</span><span class="tc">✓ 命中：</span>' +
            result.hits.map(escapeHtml).join('、');
          step.appendChild(hitsEl);
        }
        if (result.missed && result.missed.length) {
          var missEl = document.createElement('p');
          missEl.className = 'guided-kp guided-missed';
          missEl.innerHTML = '<span class="sc">✗ 遗漏：</span><span class="tc">✗ 遺漏：</span>' +
            result.missed.map(escapeHtml).join('、');
          step.appendChild(missEl);
        }
      }

      container.appendChild(step);
    });
  };

  // ── flow（流程拖拽）· 画布 slot 放置 · 点选后点 slot ──
  // payload: { canvas:{width,height,backgroundImage?}, slots:[{id,x,y}], items:[{text}] }
  // answer : { placements: { [slotId]: itemText } }
  // 评分：每个 slot 放对 +1（答对即 placements[slot.id] === slot.correctItem）
  renderers.flow = function (q, container) {
    var p = q.payload || {};
    var canvas = p.canvas || { width: 400, height: 300 };
    var slots = p.slots || [];
    var items = p.items || [];
    if (!slots.length || !items.length) {
      container.appendChild(document.createElement('div'));
      return;
    }
    if (!state.answer || typeof state.answer.placements !== 'object') {
      state.answer = { placements: {} };
    }
    var placements = state.answer.placements;

    function placedItemTextFor(slotId) { return placements[slotId] || null; }

    function onClickSlot(slotId) {
      if (state.confirmed) return;
      if (placements[slotId]) {
        // 已放：清除
        delete placements[slotId];
      } else if (state.flowActive) {
        // 有激活 item：放上
        placements[slotId] = state.flowActive;
        state.flowActive = null;
      }
      render();
    }
    function onClickItem(text) {
      if (state.confirmed) return;
      state.flowActive = (state.flowActive === text) ? null : text;
      render();
    }

    // 画布容器（保持画布宽高比，宽度撑满父容器）
    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'flow-canvas';
    canvasWrap.style.aspectRatio = canvas.width + ' / ' + canvas.height;
    if (canvas.backgroundImage) {
      canvasWrap.style.backgroundImage = 'url(' + canvas.backgroundImage + ')';
    }

    slots.forEach(function (s) {
      var leftPct = (s.x / canvas.width) * 100;
      var topPct  = (s.y / canvas.height) * 100;
      var placed = placedItemTextFor(s.id);
      var node = document.createElement('button');
      node.type = 'button';
      node.className = 'flow-slot' + (placed ? ' filled' : '');
      node.style.left = leftPct + '%';
      node.style.top  = topPct + '%';

      if (state.confirmed) {
        // 提交后比对 correctItem（回写的完整 payload）
        var slotFull = (q.payload.slots || []).find(function (x) { return x.id === s.id; });
        if (slotFull && placed && placed === slotFull.correctItem) node.classList.add('slot-correct');
        else if (placed) node.classList.add('slot-wrong');
      }
      if (placed) {
        node.textContent = placed;
      } else {
        node.innerHTML = '<span class="flow-slot-hint">?</span>';
      }
      node.addEventListener('click', function () { onClickSlot(s.id); });
      canvasWrap.appendChild(node);
    });

    container.appendChild(canvasWrap);

    // 提示
    var hint = document.createElement('p');
    hint.className = 'sort-hint';
    var placedCnt = Object.keys(placements).length;
    hint.innerHTML =
      '<span class="sc">已放置 ' + placedCnt + ' / ' + slots.length + ' · 先点下方条目，再点画布上的 ? 放置</span>' +
      '<span class="tc">已放置 ' + placedCnt + ' / ' + slots.length + ' · 先點下方條目，再點畫布上的 ? 放置</span>';
    container.appendChild(hint);

    // 条目池
    var pool = document.createElement('div');
    pool.className = 'flow-pool';
    items.forEach(function (it) {
      var text = it.text || '';
      var placedCount = 0;
      for (var sid in placements) {
        if (placements[sid] === text) placedCount++;
      }
      var isActive = state.flowActive === text;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flow-item' + (isActive ? ' active' : '') + (placedCount > 0 ? ' used' : '');
      btn.innerHTML = escapeHtml(text) +
        (placedCount > 0 ? '<span class="flow-item-badge">×' + placedCount + '</span>' : '');
      btn.addEventListener('click', function () { onClickItem(text); });
      pool.appendChild(btn);
    });
    container.appendChild(pool);
  };

  // ── match（连线配对）· 点左 → 点右 成对 ──
  // payload: { left: [{id, text}], right: [{id, text}] }   正确 match 字段在答完后补全
  // answer : { pairs: { [leftId]: rightId } }
  // 配对色循环：saffron / sage / gold / crimson / ink
  var MATCH_COLORS = ['saffron', 'sage', 'gold', 'crimson', 'ink'];
  var MATCH_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  renderers.match = function (q, container) {
    var p = q.payload || {};
    var left = (p.left || []);
    var right = (p.right || []);
    if (!left.length || !right.length) {
      container.appendChild(document.createElement('div'));
      return;
    }

    if (!state.answer || typeof state.answer.pairs !== 'object') {
      state.answer = { pairs: {} };
    }
    // 右列首次展示时洗牌，保存到 state.matchRightOrder（id 数组）避免每次 render 重洗
    if (!state.matchRightOrder || state.matchRightOrder.length !== right.length) {
      var rids = right.map(function (r) { return r.id; });
      for (var i = rids.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = rids[i]; rids[i] = rids[j]; rids[j] = t;
      }
      state.matchRightOrder = rids;
    }

    var pairs = state.answer.pairs;

    // 稳定的配对编号：按左列顺序首次遇到的 pair 编号从 0 开始
    function pairIndexOfLeft(lid) {
      var idx = 0;
      for (var i = 0; i < left.length; i++) {
        if (left[i].id === lid) {
          return pairs[lid] ? (idx) : -1;
        }
        if (pairs[left[i].id]) idx++;
      }
      return -1;
    }
    function pairColorClass(idx) {
      return idx < 0 ? '' : 'pair-' + MATCH_COLORS[idx % MATCH_COLORS.length];
    }
    function pairLetter(idx) {
      return idx < 0 ? '' : MATCH_LETTERS[idx % MATCH_LETTERS.length];
    }

    // 查 rightId 对应的左侧 leftId（反向）
    function leftOfRight(rid) {
      for (var lid in pairs) {
        if (pairs[lid] === rid) return lid;
      }
      return null;
    }

    function onClickLeft(lid) {
      if (state.confirmed) return;
      // 已配对 → 拆
      if (pairs[lid]) {
        delete pairs[lid];
        state.matchActive = null;
      } else if (state.matchActive === lid) {
        state.matchActive = null;
      } else {
        state.matchActive = lid;
      }
      render();
    }
    function onClickRight(rid) {
      if (state.confirmed) return;
      // 已配对 → 拆（反向找 leftId）
      var existingLeft = leftOfRight(rid);
      if (existingLeft) {
        delete pairs[existingLeft];
        if (state.matchActive === existingLeft) state.matchActive = null;
      } else if (state.matchActive) {
        // 有激活 left → 创建配对
        pairs[state.matchActive] = rid;
        state.matchActive = null;
      }
      // 无激活 left 点右列：暂不响应（视觉可提示，但简化先不加）
      render();
    }

    var wrap = document.createElement('div');
    wrap.className = 'match-grid';

    var colL = document.createElement('div');
    colL.className = 'match-col';
    left.forEach(function (l) {
      var pIdx = pairIndexOfLeft(l.id);
      var paired = pIdx >= 0;
      var isActive = state.matchActive === l.id;
      var correctCls = '';
      if (state.confirmed) {
        var key = (q.payload.right || []).find(function (r) { return r.id === pairs[l.id]; });
        // 正确 match 字段在 confirm 后 payload 会被 submit 响应补全
        var rightForThisLeft = (q.payload.right || []).find(function (r) { return r.match === l.id; });
        var userRid = pairs[l.id];
        if (rightForThisLeft && userRid === rightForThisLeft.id) correctCls = ' match-correct';
        else if (userRid) correctCls = ' match-wrong';
      }
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'match-item' + (paired ? ' paired ' + pairColorClass(pIdx) : '') + (isActive ? ' active' : '') + correctCls;
      row.innerHTML =
        '<span class="match-badge">' + (paired ? pairLetter(pIdx) : '') + '</span>' +
        '<span class="match-text">' + escapeHtml(l.text) + '</span>';
      row.addEventListener('click', function () { onClickLeft(l.id); });
      colL.appendChild(row);
    });

    var colR = document.createElement('div');
    colR.className = 'match-col';
    state.matchRightOrder.forEach(function (rid) {
      var r = right.find(function (x) { return x.id === rid; }) || { id: rid, text: '' };
      var lid = leftOfRight(rid);
      var pIdx = lid ? pairIndexOfLeft(lid) : -1;
      var paired = pIdx >= 0;
      var correctCls = '';
      if (state.confirmed) {
        // 用后端返回的 right[i].match 对比
        var rightFull = (q.payload.right || []).find(function (x) { return x.id === rid; });
        if (rightFull && lid && rightFull.match === lid) correctCls = ' match-correct';
        else if (lid) correctCls = ' match-wrong';
      }
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'match-item' + (paired ? ' paired ' + pairColorClass(pIdx) : '') + correctCls;
      row.innerHTML =
        '<span class="match-text">' + escapeHtml(r.text) + '</span>' +
        '<span class="match-badge">' + (paired ? pairLetter(pIdx) : '') + '</span>';
      row.addEventListener('click', function () { onClickRight(rid); });
      colR.appendChild(row);
    });

    wrap.appendChild(colL);
    wrap.appendChild(colR);
    container.appendChild(wrap);

    if (!state.confirmed) {
      var hint = document.createElement('p');
      hint.className = 'sort-hint';
      var pairedN = Object.keys(pairs).length;
      hint.innerHTML = '<span class="sc">已配对 ' + pairedN + ' / ' + left.length + ' · 点左侧、再点右侧建立配对</span>' +
                      '<span class="tc">已配對 ' + pairedN + ' / ' + left.length + ' · 點左側、再點右側建立配對</span>';
      container.appendChild(hint);
    }
  };


  // ── sort（排序题）· 上下按钮调位 ──
  // payload: { items: [{text, order}] }  order 是 1-indexed 正确位置
  // answer : { order: number[] } 数组元素是原始 index 序列（用户摆放顺序）
  renderers.sort = function (q, container) {
    var p = q.payload || {};
    var items = (p.items || []).map(function (it, i) {
      return { text: it.text || '', origIdx: i };
    });
    if (items.length === 0) {
      container.appendChild(document.createElement('div'));
      return;
    }

    // 首次渲染：洗牌一个初始顺序（避免正好是正确答案）
    if (!state.answer || !Array.isArray(state.answer.order) || state.answer.order.length !== items.length) {
      var origIndexes = items.map(function (_, i) { return i; });
      // Fisher-Yates；若洗出的顺序刚好对，再洗一次
      function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
      }
      var attempts = 0;
      do {
        shuffle(origIndexes);
        attempts++;
      } while (
        attempts < 5 &&
        origIndexes.every(function (oi, pos) { return (p.items[oi].order || 0) === pos + 1; })
      );
      state.answer = { order: origIndexes.slice() };
    }

    var order = state.answer.order;

    function moveUp(i) {
      if (i <= 0 || state.confirmed) return;
      var tmp = order[i]; order[i] = order[i - 1]; order[i - 1] = tmp;
      render();
    }
    function moveDown(i) {
      if (i >= order.length - 1 || state.confirmed) return;
      var tmp = order[i]; order[i] = order[i + 1]; order[i + 1] = tmp;
      render();
    }

    var list = document.createElement('div');
    list.className = 'sort-list';

    order.forEach(function (origIdx, pos) {
      var it = p.items[origIdx] || { text: '' };
      var row = document.createElement('div');
      row.className = 'sort-row';
      if (state.confirmed) {
        var isRight = (it.order === pos + 1);
        row.classList.add(isRight ? 'sort-correct' : 'sort-wrong');
      }

      row.innerHTML =
        '<span class="sort-pos">' + (pos + 1) + '</span>' +
        '<span class="sort-text">' + escapeHtml(it.text) + '</span>' +
        '<span class="sort-ctl">' +
          '<button type="button" class="sort-btn up" aria-label="上移"' + (pos === 0 || state.confirmed ? ' disabled' : '') + '>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>' +
          '</button>' +
          '<button type="button" class="sort-btn down" aria-label="下移"' + (pos === order.length - 1 || state.confirmed ? ' disabled' : '') + '>' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '</button>' +
        '</span>';

      row.querySelector('.up').addEventListener('click', function () { moveUp(pos); });
      row.querySelector('.down').addEventListener('click', function () { moveDown(pos); });

      list.appendChild(row);
    });

    // 提示
    if (!state.confirmed) {
      var hint = document.createElement('p');
      hint.className = 'sort-hint';
      hint.innerHTML = '<span class="sc">用 ↑↓ 把各项调整到正确顺序</span><span class="tc">用 ↑↓ 把各項調整到正確順序</span>';
      list.appendChild(hint);
    }

    container.appendChild(list);
  };

  // ── flip（速记卡）· 无对错，四档自评 → SM-2 quality ──
  // payload: { front:{text,subText?}, back:{text,example?}, noScoring:true }
  // answer : { selfRating: 'again'|'hard'|'good'|'easy' }
  renderers.flip = function (q, container) {
    var p = q.payload || {};
    var front = p.front || {};
    var back = p.back || {};

    // 外层 flip 卡片（3D 翻转容器）
    var card = document.createElement('div');
    card.className = 'flip-card' + (state.flipped ? ' flipped' : '');

    var inner = document.createElement('div');
    inner.className = 'flip-inner';

    // 正面
    var fr = document.createElement('div');
    fr.className = 'flip-face flip-front';
    fr.innerHTML =
      '<p class="flip-text">' + escapeHtml(front.text || '') + '</p>' +
      (front.subText ? '<p class="flip-sub">' + escapeHtml(front.subText) + '</p>' : '') +
      '<p class="flip-hint">' + sc('点击卡片翻转', '點擊卡片翻轉') + '</p>';

    // 背面
    var bk = document.createElement('div');
    bk.className = 'flip-face flip-back';
    bk.innerHTML =
      '<p class="flip-text">' + escapeHtml(back.text || '') + '</p>' +
      (back.example ? '<p class="flip-example">' + escapeHtml(back.example) + '</p>' : '');

    inner.appendChild(fr);
    inner.appendChild(bk);
    card.appendChild(inner);
    container.appendChild(card);

    // 点任意一面翻转（确认后禁止再翻）
    card.addEventListener('click', function () {
      if (state.confirmed) return;
      state.flipped = !state.flipped;
      card.classList.toggle('flipped', state.flipped);
      // 翻到背面时显示评分按钮；翻回正面时隐藏（但已选答案保留）
      ratings.style.display = state.flipped ? '' : 'none';
    });

    // 四档自评按钮（仅翻到背面后显示）
    var ratings = document.createElement('div');
    ratings.className = 'flip-ratings';
    ratings.style.display = state.flipped ? '' : 'none';

    var options = [
      { key: 'again', sc: ['重来', '重來'], sub: [sc('完全忘了', '完全忘了')] },
      { key: 'hard',  sc: ['困难', '困難'], sub: [sc('想起费力', '想起費力')] },
      { key: 'good',  sc: ['良好', '良好'], sub: [sc('正常想起', '正常想起')] },
      { key: 'easy',  sc: ['简单', '簡單'], sub: [sc('一眼认出', '一眼認出')] },
    ];
    options.forEach(function (o) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flip-rating flip-r-' + o.key;
      if (state.answer && state.answer.selfRating === o.key) btn.classList.add('selected');
      if (state.confirmed) btn.classList.add('disabled');
      btn.innerHTML =
        '<span class="label"><span class="sc">' + o.sc[0] + '</span><span class="tc">' + o.sc[1] + '</span></span>' +
        '<span class="sub">' + o.sub[0] + '</span>';
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation(); // 不触发 card 的翻转
        if (state.confirmed) return;
        state.answer = { selfRating: o.key };
        render();
      });
      ratings.appendChild(btn);
    });

    container.appendChild(ratings);
  };

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
      case 'flip':     return !!state.answer.selfRating;
      case 'sort':     return Array.isArray(state.answer.order) && state.answer.order.length > 0;
      case 'match':    {
        var q2 = state.questions[state.qi];
        var need = ((q2 && q2.payload && q2.payload.left) || []).length;
        return Object.keys(state.answer.pairs || {}).length === need;
      }
      case 'flow':     {
        var q3 = state.questions[state.qi];
        var slots = ((q3 && q3.payload && q3.payload.slots) || []).length;
        return Object.keys(state.answer.placements || {}).length === slots;
      }
      case 'guided':   {
        var q4 = state.questions[state.qi];
        var steps4 = (q4 && q4.payload && q4.payload.steps) || [];
        if (steps4.length === 0) return false;
        var ans = state.answer.stepAnswers || {};
        return steps4.every(function (s) {
          return (ans[String(s.stepNum)] || '').trim().length > 0;
        });
      }
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

    // M8: 后端 submitAnswer 答对时无条件软删错题本，无需前端传 flag
    // （C3 旧逻辑仅在 from=mistake 才传，导致从 reading / quiz-center 答对一道老错题
    //  时错题本不会被清；现归后端处理）
    var body = {
      questionId: q.id,
      answer: state.answer,
      timeSpentMs: Date.now() - state.tQuestionStart,
    };
    window.JX.api.post('/api/answers', body).then(function (data) {
      state.confirmed = true;
      state.lastGrade = data.grade;
      // 后端返回的 question 含完整 payload（不剥答案），用它替换本题的 public view，
      // 让 single/multi/fill/match 的"提交后高亮正确项"能真正生效
      if (data.question) state.questions[state.qi] = data.question;
      if (data.grade.isCorrect) state.correctCount++;
      else { state.wrongCount++; state.lives = Math.max(0, state.lives - 1); }
      // 埋点 · 答题结果
      if (window.JX.analytics) window.JX.analytics.track('quiz_answer', {
        questionId: q.id,
        type: q.type,
        isCorrect: !!data.grade.isCorrect,
        score: data.grade.score,
        timeSpentMs: body.timeSpentMs,
      });
      render();
    }).catch(function (err) {
      btn.disabled = false;
      window.JX.toast.error(sc('提交失败：', '提交失敗：') + (err.message || err));
    });
  }

  function nextQ() {
    state.qi++;
    state.confirmed = false;
    state.answer = null;
    state.lastGrade = null;
    state.flipped = false;
    state.matchActive = null;
    state.matchRightOrder = null;
    state.flowActive = null;
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
