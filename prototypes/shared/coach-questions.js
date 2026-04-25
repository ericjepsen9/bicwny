// coach-questions 工作台 · 列表 / 创建 / 编辑 / LLM 生成 / 批量导入
// 依赖 shared/config.js → api.js → require-auth.js 先加载
// 页面：desktop/coach-questions.html
(function () {
// coach-questions · 3a 只读骨架：/api/coach/questions 列表 + 客户端筛选
var sc = window.JX.sc, escapeHtml = window.JX.util.escapeHtml;

var TYPE_LABELS = {
  single: ['单选', '單選'], multi: ['多选', '多選'], fill: ['填空', '填空'],
  open: ['问答', '問答'], sort: ['排序', '排序'], match: ['匹配', '匹配'],
  image: ['图识', '圖識'], listen: ['听颂', '聽誦'], scenario: ['情境', '情境'],
  flow: ['流程', '流程'], guided: ['引导', '引導'], flip: ['速记卡', '速記卡'],
};
var STATUS_LABELS = {
  pending: ['待审', '待審'],
  approved: ['已通过', '已通過'],
  rejected: ['已驳回', '已駁回'],
};
var VIS_LABELS = {
  public: ['公开', '公開'],
  class_private: ['班私有', '班私有'],
  draft: ['草稿', '草稿'],
};

var state = { all: [], statusFilter: 'all', typeFilter: 'all', search: '', currentQid: null };
var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

// 把 myCoachClasses 填入 #f-class · 有班则默认选第一个 + 触发锁课
function populateClassSelect() {
  var sel = document.getElementById('f-class');
  if (!sel) return;
  if (!myCoachClasses.length) {
    sel.innerHTML = '<option value="">' + escapeHtml(sc('— 您没有负责的班级 —', '— 您沒有負責的班級 —')) + '</option>';
    createForm.ownerClassId = '';
    return;
  }
  sel.innerHTML = myCoachClasses.map(function (m) {
    var cls = m.class || {};
    var courseTitle = cls.course ? sc(cls.course.title, cls.course.titleTraditional || cls.course.title) : sc('未绑定', '未綁定');
    return '<option value="' + escapeHtml(cls.id) + '">'
      + (cls.coverEmoji || '📚') + ' ' + escapeHtml(cls.name || '—')
      + ' · ' + escapeHtml(sc('主修 ', '主修 ')) + escapeHtml(courseTitle)
      + '</option>';
  }).join('');
  // 默认选第一个并触发锁课
  sel.value = myCoachClasses[0].class.id;
  sel.dispatchEvent(new Event('change'));
}
function typeLabel(t)   { var m = TYPE_LABELS[t] || [t, t];   return sc(m[0], m[1]); }
function statusLabel(s) { var m = STATUS_LABELS[s] || [s, s]; return sc(m[0], m[1]); }
function visLabel(v)    { var m = VIS_LABELS[v] || [v, v];    return sc(m[0], m[1]); }

function filtered() {
  var q = (state.search || '').trim();
  return state.all.filter(function (row) {
    if (state.statusFilter !== 'all' && row.reviewStatus !== state.statusFilter) return false;
    if (state.typeFilter !== 'all' && row.type !== state.typeFilter) return false;
    if (q && row.questionText.indexOf(q) < 0) return false;
    return true;
  });
}

function renderList() {
  var items = filtered();
  document.getElementById('filter-count').textContent =
    items.length + sc(' 条 · 总 ', ' 條 · 總 ') + state.all.length;

  var body = document.getElementById('list-body');
  if (!state.all.length) {
    body.innerHTML = '<div class="empty-state">' +
      escapeHtml(sc('尚无题目 · 即将支持 + 新建', '尚無題目 · 即將支持 + 新建')) + '</div>';
    return;
  }
  if (!items.length) {
    body.innerHTML = '<div class="empty-state">' +
      escapeHtml(sc('当前筛选无结果', '當前篩選無結果')) + '</div>';
    return;
  }
  var rows = items.map(function (r) {
    return '<tr data-row data-qid="' + escapeHtml(r.id) + '">' +
      '<td class="q-stem-cell">' + escapeHtml(truncate(r.questionText, 48)) + '</td>' +
      '<td><span class="q-type-badge">' + escapeHtml(typeLabel(r.type)) + '</span></td>' +
      '<td><span class="q-vis">' + escapeHtml(visLabel(r.visibility)) + '</span></td>' +
      '<td><span class="q-status ' + r.reviewStatus + '">' + escapeHtml(statusLabel(r.reviewStatus)) + '</span></td>' +
      '<td>' + escapeHtml(window.JX.util.relativeTime(r.createdAt)) + '</td>' +
    '</tr>';
  }).join('');
  body.innerHTML =
    '<table class="q-list"><thead><tr>' +
      '<th>' + escapeHtml(sc('题干', '題幹')) + '</th>' +
      '<th>' + escapeHtml(sc('题型', '題型')) + '</th>' +
      '<th>' + escapeHtml(sc('可见性', '可見性')) + '</th>' +
      '<th>' + escapeHtml(sc('审核', '審核')) + '</th>' +
      '<th>' + escapeHtml(sc('创建时间', '建立時間')) + '</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>';
}

function showErr(msg) {
  document.getElementById('list-body').innerHTML =
    '<div class="empty-state err-state">' + escapeHtml(msg) + '</div>';
  document.getElementById('filter-count').textContent = '';
}

function boot() {
  // 课程列表（供新建表单复用）
  window.JX.api.get('/api/courses')
    .then(function (list) { courseList = Array.isArray(list) ? list : []; })
    .catch(function () { courseList = []; });

  // 我的班级（供 class_private 选项预拉，可能 admin 没班级则空）
  window.JX.api.get('/api/coach/classes')
    .then(function (list) { myCoachClasses = Array.isArray(list) ? list : []; })
    .catch(function () { myCoachClasses = []; });

  window.JX.api.get('/api/coach/questions?limit=500')
    .then(function (list) {
      state.all = Array.isArray(list) ? list : [];
      renderList();
    })
    .catch(function (err) {
      showErr(sc('加载失败：', '加載失敗：') + (err.message || err));
    });
}

// ── 详情抽屉 (3b) ────────────────────────────────
function renderPayload(q) {
  var p = q.payload || {};
  var t = q.type;
  if (t === 'single' || t === 'image' || t === 'listen') {
    var opts = p.options || [];
    return opts.map(function (o, i) {
      return '<div class="dr-opt' + (o.correct ? ' correct' : '') + '">' +
        '<span class="dr-letter">' + LETTERS[i] + '</span>' +
        '<span>' + escapeHtml(o.text) + '</span>' +
      '</div>';
    }).join('');
  }
  if (t === 'multi' || t === 'scenario') {
    var opts2 = p.options || [];
    var scenarioBlock = (t === 'scenario' && p.scenario)
      ? '<p class="dr-stem" style="margin-bottom:var(--sp-3);font-style:italic;">' + escapeHtml(p.scenario) + '</p>' : '';
    return scenarioBlock + opts2.map(function (o, i) {
      return '<div class="dr-opt' + (o.correct ? ' correct' : '') + '">' +
        '<span class="dr-letter">' + LETTERS[i] + '</span>' +
        '<span>' + escapeHtml(o.text) +
          (o.reason ? '<br><small style="color:var(--ink-3);">' + escapeHtml(o.reason) + '</small>' : '') +
        '</span>' +
      '</div>';
    }).join('');
  }
  if (t === 'fill') {
    var lines = (p.verseLines || []).map(function (l) {
      return escapeHtml(l).replace('____', '<b style="color:var(--saffron);">' + escapeHtml(p.correctWord || '____') + '</b>');
    }).join('<br>');
    var opts3 = (p.options || []).map(function (o, i) {
      var ok = o === p.correctWord;
      return '<div class="dr-opt' + (ok ? ' correct' : '') + '"><span class="dr-letter">' + LETTERS[i] + '</span>' + escapeHtml(o) + '</div>';
    }).join('');
    return '<div style="padding:var(--sp-3);background:var(--saffron-pale);border-radius:var(--r-sm);margin-bottom:var(--sp-3);font-family:var(--font-serif);line-height:2;">' +
      lines + '</div>' + opts3;
  }
  if (t === 'open') {
    var ref = p.referenceAnswer || '—';
    var kps = (p.keyPoints || []).map(function (k) {
      var point = (k && k.point) || k;
      return '<li>' + escapeHtml(point) + '</li>';
    }).join('');
    return '<p class="dr-stem" style="margin-bottom:var(--sp-3);">' + escapeHtml(ref) + '</p>' +
      (kps ? '<ul style="padding-left:20px;color:var(--ink-2);">' + kps + '</ul>' : '');
  }
  // 其他题型：原始 JSON 预览
  return '<pre class="dr-code">' + escapeHtml(JSON.stringify(p, null, 2)) + '</pre>';
}

function openDrawer(qid) {
  var q = state.all.find(function (r) { return r.id === qid; });
  if (!q) return;
  state.currentQid = qid;
  state.drawerMode = 'view';
  document.getElementById('dr-save').style.display = 'none';
  document.getElementById('dr-delete').style.display = '';
  // 3d: edit 按钮显示规则 —— 已 approved 的 public 题对非 admin 锁；其它情况显示
  var role = (window.JX.user && window.JX.user.role) || 'student';
  var locked = role !== 'admin' && q.visibility === 'public' && q.reviewStatus === 'approved';
  var editBtn = document.getElementById('dr-edit');
  editBtn.style.display = locked ? 'none' : '';
  // 非单/多/填/问的题型 3c 表单不支持 → 编辑按钮一并隐藏
  if (!/^(single|multi|fill|open)$/.test(q.type)) editBtn.style.display = 'none';

  document.getElementById('dr-type').textContent = typeLabel(q.type);
  var statusEl = document.getElementById('dr-status');
  statusEl.className = 'q-status ' + q.reviewStatus;
  statusEl.textContent = statusLabel(q.reviewStatus);
  document.getElementById('dr-err').textContent = '';

  var lockReason = '';
  if (q.reviewStatus === 'approved' && q.visibility === 'public') {
    lockReason = sc('已通过审核的公开题不可删除（会影响在学学员）', '已通過審核的公開題不可刪除（會影響在學學員）');
  }
  var delBtn = document.getElementById('dr-delete');
  delBtn.disabled = !!lockReason;
  if (lockReason) document.getElementById('dr-err').textContent = lockReason;

  var body = document.getElementById('dr-body');
  body.innerHTML =
    '<h3>' + escapeHtml(sc('题干', '題幹')) + '</h3>' +
    '<p class="dr-stem">' + escapeHtml(q.questionText) + '</p>' +
    '<h3>' + escapeHtml(sc('选项 / 答案', '選項 / 答案')) + '</h3>' +
    renderPayload(q) +
    (q.correctText ? '<h3>' + escapeHtml(sc('解析', '解析')) + '</h3>' +
      '<p class="dr-stem">' + escapeHtml(q.correctText) + '</p>' : '') +
    (q.wrongText ? '<h3>' + escapeHtml(sc('易错点', '易錯點')) + '</h3>' +
      '<p class="dr-stem">' + escapeHtml(q.wrongText) + '</p>' : '') +
    '<h3>' + escapeHtml(sc('元数据', '元數據')) + '</h3>' +
    '<div class="dr-meta">' +
      '<span><b>' + escapeHtml(sc('可见性', '可見性')) + ':</b> ' + escapeHtml(visLabel(q.visibility)) + '</span>' +
      '<span><b>' + escapeHtml(sc('难度', '難度')) + ':</b> ' + (q.difficulty || 0) + '</span>' +
      '<span><b>' + escapeHtml(sc('来源', '來源')) + ':</b> ' + escapeHtml(q.source || '—') + '</span>' +
      (q.tags && q.tags.length ? '<span><b>' + escapeHtml(sc('标签', '標籤')) + ':</b> ' + escapeHtml(q.tags.join(' · ')) + '</span>' : '') +
      '<span><b>ID:</b> ' + escapeHtml(q.id) + '</span>' +
    '</div>';

  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-backdrop').classList.remove('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'true');
  state.currentQid = null;
  state.drawerMode = null;
  document.getElementById('dr-edit').style.display = 'none';
  // 复位 save 按钮（generate 流可能改了 label）
  var save = document.getElementById('dr-save');
  save.innerHTML = '<span class="sc">保存</span><span class="tc">保存</span>';
  save.removeAttribute('data-result');
}

document.getElementById('dr-close').addEventListener('click', closeDrawer);
document.getElementById('dr-cancel').addEventListener('click', closeDrawer);
document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') closeDrawer();
});

document.getElementById('dr-delete').addEventListener('click', function () {
  var qid = state.currentQid;
  if (!qid) return;
  if (!confirm(sc('确认删除此题？此操作不可恢复。', '確認刪除此題？此操作不可恢復。'))) return;

  var btn = this;
  btn.disabled = true;
  document.getElementById('dr-err').textContent = '';
  window.JX.api.del('/api/coach/questions/' + encodeURIComponent(qid))
    .then(function () {
      state.all = state.all.filter(function (r) { return r.id !== qid; });
      renderList();
      closeDrawer();
    })
    .catch(function (err) {
      btn.disabled = false;
      var msg;
      if (err && err.status === 400) msg = sc('有答题记录，不能删除 · 请联系管理员', '有答題記錄，不能刪除 · 請聯繫管理員');
      else if (err && err.status === 403) msg = sc('无权删除此题', '無權刪除此題');
      else msg = sc('删除失败：', '刪除失敗：') + (err && err.message || err);
      document.getElementById('dr-err').textContent = msg;
    });
});

// ── 新建表单 (3c) ──────────────────────────────
var courseCache = {}; // slug → full course (chapters+lessons)
var courseList = [];  // published courses
var myCoachClasses = []; // 我作为 coach 负责的班级（含 .class.course）
var createForm = {    // 临时表单状态
  type: 'single',
  courseSlug: '',
  courseId: '',
  chapterId: '',
  lessonId: '',
  ownerClassId: '',
  options: [{ text: '', correct: true }, { text: '', correct: false }],
};

function loadCourseDetail(slug) {
  if (courseCache[slug]) return Promise.resolve(courseCache[slug]);
  return window.JX.api.get('/api/courses/' + encodeURIComponent(slug)).then(function (d) {
    courseCache[slug] = d.course || d;
    return courseCache[slug];
  });
}

function setSelectOptions(sel, items, valueKey, labelFn, placeholder) {
  sel.innerHTML = '<option value="">' + escapeHtml(placeholder) + '</option>' +
    items.map(function (it) {
      return '<option value="' + escapeHtml(it[valueKey]) + '">' + escapeHtml(labelFn(it)) + '</option>';
    }).join('');
}

function renderTypeEditor() {
  var host = document.getElementById('f-type-editor');
  var t = createForm.type;
  if (t === 'single' || t === 'multi') {
    var labelOk = t === 'single'
      ? sc('恰 1 个正确（radio）', '恰 1 個正確（radio）')
      : sc('至少 1 个正确（可多选）', '至少 1 個正確（可多選）');
    host.innerHTML = '<p class="f-hint">' + escapeHtml(labelOk) + '</p>' +
      '<div id="opt-rows"></div>' +
      '<button type="button" class="f-add-opt" id="btn-add-opt">+ ' + escapeHtml(sc('添加选项', '添加選項')) + '</button>';
    renderOptionRows();
    document.getElementById('btn-add-opt').addEventListener('click', function () {
      createForm.options.push({ text: '', correct: false });
      renderOptionRows();
    });
  } else if (t === 'fill') {
    host.innerHTML =
      '<div class="f-row"><label>' + escapeHtml(sc('偈颂行（每行一句，用 ____ 标空位）', '偈頌行（每行一句，用 ____ 標空位）')) + '</label>' +
      '<textarea class="f-area" id="f-verselines" rows="3" placeholder="菩提心如劫末火\n刹那能毁诸 ____"></textarea></div>' +
      '<div class="f-row-split">' +
        '<div><label>' + escapeHtml(sc('正确字', '正確字')) + '</label>' +
          '<input class="f-input" id="f-correctword" placeholder="重罪"></div>' +
        '<div style="grid-column:span 2;"><label>' + escapeHtml(sc('备选（逗号分隔）', '備選（逗號分隔）')) + '</label>' +
          '<input class="f-input" id="f-fillopts" placeholder="重罪, 善业, 功德, 无明"></div>' +
      '</div>';
  } else if (t === 'open') {
    host.innerHTML =
      '<div class="f-row"><label>' + escapeHtml(sc('参考答案', '參考答案')) + '</label>' +
      '<textarea class="f-area" id="f-refans" rows="3"></textarea></div>' +
      '<div class="f-row"><label>' + escapeHtml(sc('关键要点（每行一条）', '關鍵要點（每行一條）')) + '</label>' +
      '<textarea class="f-area" id="f-keypoints" rows="4" placeholder="成佛因\n净罪障\n圆福德"></textarea></div>';
  }
}

function renderOptionRows() {
  var host = document.getElementById('opt-rows');
  if (!host) return;
  var t = createForm.type;
  host.innerHTML = createForm.options.map(function (o, i) {
    var markInput = t === 'single'
      ? '<input type="radio" name="opt-correct" ' + (o.correct ? 'checked' : '') + ' data-i="' + i + '">'
      : '<input type="checkbox" ' + (o.correct ? 'checked' : '') + ' data-i="' + i + '">';
    return '<div class="f-opt-row">' +
      '<span class="dr-letter">' + LETTERS[i] + '</span>' +
      '<input type="text" value="' + escapeHtml(o.text) + '" data-i="' + i + '" placeholder="' + escapeHtml(sc('选项文本', '選項文本')) + '">' +
      '<label class="f-opt-mark">' + markInput + escapeHtml(sc('正确', '正確')) + '</label>' +
      (createForm.options.length > 2
        ? '<button type="button" class="f-opt-del" data-del="' + i + '" aria-label="删除">×</button>' : '') +
    '</div>';
  }).join('');
  // 绑定事件
  host.querySelectorAll('input[type=text]').forEach(function (inp) {
    inp.addEventListener('input', function () {
      createForm.options[Number(this.dataset.i)].text = this.value;
    });
  });
  host.querySelectorAll('input[type=radio], input[type=checkbox]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      var idx = Number(this.dataset.i);
      if (t === 'single') {
        createForm.options.forEach(function (o, j) { o.correct = (j === idx); });
      } else {
        createForm.options[idx].correct = this.checked;
      }
    });
  });
  host.querySelectorAll('.f-opt-del').forEach(function (btn) {
    btn.addEventListener('click', function () {
      createForm.options.splice(Number(this.dataset.del), 1);
      renderOptionRows();
    });
  });
}

function renderCreateForm() {
  var body = document.getElementById('dr-body');
  body.innerHTML =
    '<div class="f-row-split">' +
      '<div><label>' + escapeHtml(sc('题型', '題型')) + '</label>' +
        '<select class="f-sel" id="f-type">' +
          '<option value="single">' + escapeHtml(sc('单选', '單選')) + '</option>' +
          '<option value="multi">' + escapeHtml(sc('多选', '多選')) + '</option>' +
          '<option value="fill">' + escapeHtml(sc('填空', '填空')) + '</option>' +
          '<option value="open">' + escapeHtml(sc('问答', '問答')) + '</option>' +
        '</select></div>' +
      '<div><label>' + escapeHtml(sc('难度', '難度')) + '</label>' +
        '<select class="f-sel" id="f-diff"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div>' +
      '<div><label>' + escapeHtml(sc('可见性', '可見性')) + '</label>' +
        '<select class="f-sel" id="f-vis">' +
          '<option value="public">' + escapeHtml(sc('公开（待审）', '公開（待審）')) + '</option>' +
          '<option value="class_private">' + escapeHtml(sc('班级私题（无需审核）', '班級私題（無需審核）')) + '</option>' +
        '</select></div>' +
    '</div>' +
    '<div class="f-row" id="f-class-row" style="display:none;">' +
      '<label>' + escapeHtml(sc('归属班级 · 自动绑该班主修法本', '歸屬班級 · 自動綁該班主修法本')) + '</label>' +
      '<select class="f-sel" id="f-class"></select>' +
    '</div>' +
    '<div class="f-row-split">' +
      '<div><label>' + escapeHtml(sc('法本', '法本')) + '</label><select class="f-sel" id="f-course"></select></div>' +
      '<div><label>' + escapeHtml(sc('章', '章')) + '</label><select class="f-sel" id="f-chapter" disabled></select></div>' +
      '<div><label>' + escapeHtml(sc('课时', '課時')) + '</label><select class="f-sel" id="f-lesson" disabled></select></div>' +
    '</div>' +
    '<div class="f-row"><label>' + escapeHtml(sc('题干', '題幹')) + '</label>' +
      '<textarea class="f-area" id="f-stem" rows="2" required></textarea></div>' +
    '<div class="f-row"><label>' + escapeHtml(sc('答案选项 / 内容', '答案選項 / 內容')) + '</label>' +
      '<div id="f-type-editor"></div></div>' +
    '<div class="f-row"><label>' + escapeHtml(sc('解析', '解析')) + '</label>' +
      '<textarea class="f-area" id="f-correct" rows="2"></textarea></div>' +
    '<div class="f-row"><label>' + escapeHtml(sc('易错点（可选）', '易錯點（可選）')) + '</label>' +
      '<textarea class="f-area" id="f-wrong" rows="2"></textarea></div>' +
    '<div class="f-row-split">' +
      '<div style="grid-column:span 2;"><label>' + escapeHtml(sc('来源', '來源')) + '</label>' +
        '<input class="f-input" id="f-source" placeholder="《入菩萨行论》第一品"></div>' +
      '<div><label>' + escapeHtml(sc('标签（逗号分隔）', '標籤（逗號分隔）')) + '</label>' +
        '<input class="f-input" id="f-tags" placeholder="菩提心, 发心"></div>' +
    '</div>';

  // 填充课程选择
  setSelectOptions(document.getElementById('f-course'), courseList, 'slug', function (c) { return c.title; }, sc('选择法本', '選擇法本'));

  // 可见性切换：class_private 显示班级选择 + 锁定课程到该班主修
  document.getElementById('f-vis').addEventListener('change', function () {
    var vis = this.value;
    var classRow = document.getElementById('f-class-row');
    var courseSel = document.getElementById('f-course');
    if (vis === 'class_private') {
      classRow.style.display = '';
      populateClassSelect();
    } else {
      classRow.style.display = 'none';
      courseSel.disabled = false;
      createForm.ownerClassId = '';
    }
  });

  // 班级 picker：选中后自动锁课
  document.getElementById('f-class').addEventListener('change', function () {
    var classId = this.value;
    createForm.ownerClassId = classId;
    if (!classId) return;
    var m = myCoachClasses.find(function (x) { return x.class && x.class.id === classId; });
    if (!m || !m.class.course) return;
    var courseSel = document.getElementById('f-course');
    courseSel.value = m.class.course.slug;
    courseSel.disabled = true;
    // 触发 change 加载章节
    courseSel.dispatchEvent(new Event('change'));
  });

  document.getElementById('f-type').addEventListener('change', function () {
    createForm.type = this.value;
    if (this.value === 'single') createForm.options = [{ text: '', correct: true }, { text: '', correct: false }];
    else if (this.value === 'multi') createForm.options = [{ text: '', correct: true }, { text: '', correct: true }, { text: '', correct: false }];
    renderTypeEditor();
  });
  document.getElementById('f-course').addEventListener('change', function () {
    var slug = this.value;
    createForm.courseSlug = slug;
    var chSel = document.getElementById('f-chapter');
    var leSel = document.getElementById('f-lesson');
    chSel.disabled = leSel.disabled = true;
    chSel.innerHTML = '<option>' + escapeHtml(sc('加载中…', '加載中…')) + '</option>';
    leSel.innerHTML = '';
    if (!slug) { chSel.innerHTML = ''; return; }
    loadCourseDetail(slug).then(function (c) {
      createForm.courseId = c.id;
      createForm.chapterId = '';
      createForm.lessonId = '';
      setSelectOptions(chSel, c.chapters || [], 'id', function (ch) { return ch.title; }, sc('选择章', '選擇章'));
      chSel.disabled = false;
    });
  });
  document.getElementById('f-chapter').addEventListener('change', function () {
    createForm.chapterId = this.value;
    var course = courseCache[createForm.courseSlug];
    var ch = (course.chapters || []).find(function (x) { return x.id === createForm.chapterId; });
    var leSel = document.getElementById('f-lesson');
    setSelectOptions(leSel, (ch && ch.lessons) || [], 'id', function (l) { return l.title; }, sc('选择课时', '選擇課時'));
    leSel.disabled = false;
  });
  document.getElementById('f-lesson').addEventListener('change', function () {
    createForm.lessonId = this.value;
  });

  document.getElementById('f-type').value = createForm.type;
  renderTypeEditor();
}

function openCreateDrawer() {
  if (!courseList.length) {
    window.JX.toast.warn(sc('课程列表加载中，请稍候', '課程列表加載中，請稍候'));
    return;
  }
  state.drawerMode = 'create';
  state.currentQid = null;
  createForm = {
    type: 'single', courseSlug: '', courseId: '', chapterId: '', lessonId: '', ownerClassId: '',
    options: [{ text: '', correct: true }, { text: '', correct: false }],
  };

  document.getElementById('dr-type').textContent = sc('新题', '新題');
  var statusEl = document.getElementById('dr-status');
  statusEl.className = 'q-status pending';
  statusEl.textContent = sc('未保存', '未保存');
  document.getElementById('dr-err').textContent = '';
  document.getElementById('dr-delete').style.display = 'none';
  document.getElementById('dr-save').style.display = '';

  renderCreateForm();
  // 从 edit 模式切回后可能禁用；确保 create 模式重新启用
  ['f-type', 'f-course', 'f-chapter', 'f-lesson'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && id !== 'f-chapter' && id !== 'f-lesson') el.disabled = false;
    // chapter/lesson 仍需级联选完课才能启用
  });

  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
}

function collectCreateBody() {
  var stem = document.getElementById('f-stem').value.trim();
  if (!stem) throw new Error(sc('请填写题干', '請填寫題幹'));
  if (!createForm.courseId || !createForm.chapterId || !createForm.lessonId) {
    throw new Error(sc('请选择 法本 / 章 / 课时', '請選擇 法本 / 章 / 課時'));
  }
  var payload;
  var t = createForm.type;
  if (t === 'single' || t === 'multi') {
    var opts = createForm.options.filter(function (o) { return (o.text || '').trim(); });
    if (opts.length < 2) throw new Error(sc('至少 2 个选项', '至少 2 個選項'));
    var nCorrect = opts.filter(function (o) { return o.correct; }).length;
    if (t === 'single' && nCorrect !== 1) throw new Error(sc('单选题必须恰 1 个正确', '單選題必須恰 1 個正確'));
    if (t === 'multi'  && nCorrect < 1)   throw new Error(sc('多选题至少 1 个正确', '多選題至少 1 個正確'));
    payload = { options: opts };
    if (t === 'multi') payload.scoringMode = 'strict';
  } else if (t === 'fill') {
    var vls = document.getElementById('f-verselines').value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    var cw = document.getElementById('f-correctword').value.trim();
    var fopts = document.getElementById('f-fillopts').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!vls.length || !cw) throw new Error(sc('填空题：请填偈颂行 + 正确字', '填空題：請填偈頌行 + 正確字'));
    if (!fopts.includes(cw)) fopts.push(cw);
    payload = { verseLines: vls, correctWord: cw, options: fopts };
  } else if (t === 'open') {
    var ref = document.getElementById('f-refans').value.trim();
    var kps = document.getElementById('f-keypoints').value.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean)
      .map(function (pt) { return { point: pt, signals: [] }; });
    if (!ref) throw new Error(sc('请填写参考答案', '請填寫參考答案'));
    payload = { referenceAnswer: ref, keyPoints: kps, minLength: 20, maxLength: 400 };
  } else {
    throw new Error(sc('不支持的题型（请用批量导入）', '不支持的題型（請用批量導入）'));
  }

  var tags = document.getElementById('f-tags').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
  var visEl = document.getElementById('f-vis');
  var visibility = (visEl && visEl.value) || 'public';
  if (visibility === 'class_private' && !createForm.ownerClassId) {
    throw new Error(sc('班级私题需选择归属班级', '班級私題需選擇歸屬班級'));
  }
  return {
    courseId: createForm.courseId,
    chapterId: createForm.chapterId,
    lessonId: createForm.lessonId,
    type: t,
    visibility: visibility,
    ownerClassId: visibility === 'class_private' ? createForm.ownerClassId : undefined,
    questionText: stem,
    correctText: document.getElementById('f-correct').value.trim(),
    wrongText: document.getElementById('f-wrong').value.trim(),
    source: document.getElementById('f-source').value.trim() || '—',
    difficulty: Number(document.getElementById('f-diff').value),
    tags: tags,
    payload: payload,
  };
}

document.getElementById('btn-new').addEventListener('click', openCreateDrawer);

// ── 编辑抽屉 (3d) —— 复用 renderCreateForm 然后 prefill ──
function prefillEditForm(q) {
  // type + editor
  createForm.type = q.type;
  var p = q.payload || {};
  if (q.type === 'single' || q.type === 'multi') {
    createForm.options = (p.options || []).map(function (o) {
      return { text: o.text || '', correct: !!o.correct };
    });
    if (createForm.options.length < 2) {
      createForm.options = [{ text: '', correct: true }, { text: '', correct: false }];
    }
  }
  document.getElementById('f-type').value = q.type;
  renderTypeEditor();

  if (q.type === 'fill') {
    var lines = (p.verseLines || []).join('\n');
    document.getElementById('f-verselines').value = lines;
    document.getElementById('f-correctword').value = p.correctWord || '';
    document.getElementById('f-fillopts').value = (p.options || []).join(', ');
  } else if (q.type === 'open') {
    document.getElementById('f-refans').value = p.referenceAnswer || '';
    var pts = (p.keyPoints || []).map(function (k) { return (k && k.point) || k || ''; });
    document.getElementById('f-keypoints').value = pts.join('\n');
  }

  // 课/章/课时：edit 模式下锁死（后端 PATCH 不接受 location 变更）
  var course = courseList.find(function (c) { return c.id === q.courseId; });
  var fCourse = document.getElementById('f-course');
  var fChap = document.getElementById('f-chapter');
  var fLess = document.getElementById('f-lesson');
  var cascadePromise;
  if (course) {
    createForm.courseSlug = course.slug;
    createForm.courseId = course.id;
    fCourse.value = course.slug;
    cascadePromise = loadCourseDetail(course.slug).then(function (d) {
      setSelectOptions(fChap, d.chapters || [], 'id', function (ch) { return ch.title; }, sc('选择章', '選擇章'));
      fChap.value = q.chapterId;
      createForm.chapterId = q.chapterId;
      var ch = (d.chapters || []).find(function (x) { return x.id === q.chapterId; });
      if (ch) {
        setSelectOptions(fLess, ch.lessons || [], 'id', function (l) { return l.title; }, sc('选择课时', '選擇課時'));
        fLess.value = q.lessonId;
        createForm.lessonId = q.lessonId;
      }
    });
  } else {
    // 找不到所属课程（可能已下架）→ 保留 id，禁用级联
    createForm.courseId = q.courseId;
    createForm.chapterId = q.chapterId;
    createForm.lessonId = q.lessonId;
    cascadePromise = Promise.resolve();
  }
  cascadePromise.then(function () {
    [fCourse, fChap, fLess].forEach(function (sel) { sel.disabled = true; });
  });

  document.getElementById('f-stem').value = q.questionText;
  document.getElementById('f-correct').value = q.correctText || '';
  document.getElementById('f-wrong').value = q.wrongText || '';
  document.getElementById('f-source').value = q.source || '';
  document.getElementById('f-diff').value = String(q.difficulty || 2);
  document.getElementById('f-tags').value = (q.tags || []).join(', ');

  // type select 也禁用（避免从 single 切到 fill 后后端 PATCH 难处理）
  document.getElementById('f-type').disabled = true;
}

function openEditDrawer() {
  var qid = state.currentQid;
  if (!qid) return;
  var q = state.all.find(function (r) { return r.id === qid; });
  if (!q) return;
  state.drawerMode = 'edit';

  // 重置临时表单
  createForm = {
    type: q.type, courseSlug: '', courseId: '', chapterId: '', lessonId: '',
    options: [{ text: '', correct: true }, { text: '', correct: false }],
  };

  document.getElementById('dr-type').textContent = typeLabel(q.type);
  var statusEl = document.getElementById('dr-status');
  statusEl.className = 'q-status ' + q.reviewStatus;
  statusEl.textContent = statusLabel(q.reviewStatus);
  document.getElementById('dr-err').textContent = '';
  document.getElementById('dr-edit').style.display = 'none';
  document.getElementById('dr-delete').style.display = 'none';
  document.getElementById('dr-save').style.display = '';

  renderCreateForm();
  prefillEditForm(q);

  // 给 coach 提示：改 public 题会触发重审
  var role = (window.JX.user && window.JX.user.role) || 'student';
  if (role !== 'admin' && q.visibility === 'public') {
    document.getElementById('dr-err').textContent =
      sc('提示：保存后此题将回到"待审"状态', '提示：保存後此題將回到「待審」狀態');
  }
}

document.getElementById('dr-edit').addEventListener('click', openEditDrawer);

// ── LLM 生成向导 (3e) ────────────────────────────
var genForm = { courseSlug: '', courseId: '', chapterId: '', lessonId: '', type: 'single', count: 5, difficulty: 2 };

function renderGenerateForm() {
  var body = document.getElementById('dr-body');
  body.innerHTML =
    '<div class="f-row-split">' +
      '<div><label>' + escapeHtml(sc('法本', '法本')) + '</label>' +
        '<select class="f-sel" id="g-course"></select></div>' +
      '<div><label>' + escapeHtml(sc('章', '章')) + '</label>' +
        '<select class="f-sel" id="g-chapter" disabled></select></div>' +
      '<div><label>' + escapeHtml(sc('课时', '課時')) + '</label>' +
        '<select class="f-sel" id="g-lesson" disabled></select></div>' +
    '</div>' +
    '<div class="f-row-split">' +
      '<div><label>' + escapeHtml(sc('题型', '題型')) + '</label>' +
        '<select class="f-sel" id="g-type">' +
          '<option value="single">' + escapeHtml(sc('单选', '單選')) + '</option>' +
          '<option value="multi">' + escapeHtml(sc('多选', '多選')) + '</option>' +
          '<option value="fill">' + escapeHtml(sc('填空', '填空')) + '</option>' +
          '<option value="open">' + escapeHtml(sc('问答', '問答')) + '</option>' +
        '</select></div>' +
      '<div><label>' + escapeHtml(sc('数量', '數量')) + '</label>' +
        '<select class="f-sel" id="g-count">' +
          '<option value="3">3</option><option value="5" selected>5</option>' +
          '<option value="8">8</option><option value="12">12</option>' +
        '</select></div>' +
      '<div><label>' + escapeHtml(sc('难度', '難度')) + '</label>' +
        '<select class="f-sel" id="g-diff"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option></select></div>' +
    '</div>' +
    '<div class="f-row"><label>' + escapeHtml(sc('法本原文（≥ 20 字；越充分生成越好）', '法本原文（≥ 20 字；越充分生成越好）')) + '</label>' +
      '<textarea class="f-area" id="g-passage" rows="10" placeholder="' +
        escapeHtml(sc('粘贴想要让 LLM 参考的法本原文段落，可包含偈颂 + 注释。', '貼上想要讓 LLM 參考的法本原文段落，可包含偈頌 + 註釋。')) +
      '"></textarea>' +
      '<p class="f-hint">' + escapeHtml(sc('生成耗时约 10-30 秒 · 生成后所有题目进入待审状态', '生成耗時約 10-30 秒 · 生成後所有題目進入待審狀態')) + '</p>' +
    '</div>';

  setSelectOptions(document.getElementById('g-course'), courseList, 'slug', function (c) { return c.title; }, sc('选择法本', '選擇法本'));

  document.getElementById('g-course').addEventListener('change', function () {
    var slug = this.value;
    genForm.courseSlug = slug;
    var chSel = document.getElementById('g-chapter');
    var leSel = document.getElementById('g-lesson');
    chSel.disabled = leSel.disabled = true;
    chSel.innerHTML = '<option>' + escapeHtml(sc('加载中…', '加載中…')) + '</option>';
    leSel.innerHTML = '';
    if (!slug) { chSel.innerHTML = ''; return; }
    loadCourseDetail(slug).then(function (c) {
      genForm.courseId = c.id; genForm.chapterId = ''; genForm.lessonId = '';
      setSelectOptions(chSel, c.chapters || [], 'id', function (ch) { return ch.title; }, sc('选择章', '選擇章'));
      chSel.disabled = false;
    });
  });
  document.getElementById('g-chapter').addEventListener('change', function () {
    genForm.chapterId = this.value;
    var c = courseCache[genForm.courseSlug];
    var ch = (c.chapters || []).find(function (x) { return x.id === genForm.chapterId; });
    var leSel = document.getElementById('g-lesson');
    setSelectOptions(leSel, (ch && ch.lessons) || [], 'id', function (l) { return l.title; }, sc('选择课时', '選擇課時'));
    leSel.disabled = false;
  });
  document.getElementById('g-lesson').addEventListener('change', function () { genForm.lessonId = this.value; });
  document.getElementById('g-type').addEventListener('change', function () { genForm.type = this.value; });
  document.getElementById('g-count').addEventListener('change', function () { genForm.count = Number(this.value); });
  document.getElementById('g-diff').addEventListener('change', function () { genForm.difficulty = Number(this.value); });
}

function openGenerateDrawer() {
  if (!courseList.length) {
    window.JX.toast.warn(sc('课程列表加载中，请稍候', '課程列表加載中，請稍候'));
    return;
  }
  state.drawerMode = 'generate';
  state.currentQid = null;
  genForm = { courseSlug: '', courseId: '', chapterId: '', lessonId: '', type: 'single', count: 5, difficulty: 2 };

  document.getElementById('dr-type').textContent = '⚡ LLM';
  var statusEl = document.getElementById('dr-status');
  statusEl.className = 'q-status pending';
  statusEl.textContent = sc('生成', '生成');
  document.getElementById('dr-err').textContent = '';
  document.getElementById('dr-delete').style.display = 'none';
  document.getElementById('dr-edit').style.display = 'none';
  document.getElementById('dr-save').style.display = '';
  document.getElementById('dr-save').innerHTML = '<span class="sc">生成</span><span class="tc">生成</span>';

  renderGenerateForm();

  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
}

function renderGenerateResult(data) {
  state.drawerMode = 'generate-done';
  var body = document.getElementById('dr-body');
  var ok = data.succeeded, fail = data.failed, tot = data.total;
  var summaryClass = fail > 0 ? 'gen-summary has-err' : 'gen-summary';
  var summaryHtml =
    '<p style="font-weight:700;margin-bottom:6px;">' +
      escapeHtml(sc('LLM 已返回 ', 'LLM 已返回 ')) + tot +
      escapeHtml(sc(' 道题 · 落库 ', ' 道題 · 落庫 ')) + ok +
      escapeHtml(sc(' · 丢弃 ', ' · 丟棄 ')) + fail +
    '</p>' +
    '<p style="color:var(--ink-3);">' +
      escapeHtml(sc('新题均为「待审」状态，可在列表筛选查看', '新題均為「待審」狀態，可在列表篩選查看')) +
    '</p>';

  var okListHtml = (data.questions || []).map(function (q) {
    return '<div class="gen-ok-item">' +
      '<b>✓</b> ' + escapeHtml(q.questionText).slice(0, 80) +
    '</div>';
  }).join('');
  var skipListHtml = (data.skipped || []).map(function (s) {
    var raw = s.raw ? ('<br><small style="color:var(--ink-4);">' + escapeHtml(JSON.stringify(s.raw).slice(0, 120)) + '…</small>') : '';
    return '<div class="gen-skip-item">' +
      '<b>✗ #' + s.index + '</b> ' + escapeHtml(s.reason) + raw +
    '</div>';
  }).join('');

  body.innerHTML =
    '<div class="' + summaryClass + '">' + summaryHtml + '</div>' +
    (okListHtml ? '<h3>' + escapeHtml(sc('成功落库', '成功落庫')) + '</h3>' + okListHtml : '') +
    (skipListHtml ? '<h3>' + escapeHtml(sc('未入库（含原因）', '未入庫（含原因）')) + '</h3>' + skipListHtml : '');

  // 底栏：生成完毕 → 只留关闭 + 完成
  document.getElementById('dr-save').innerHTML = '<span class="sc">完成</span><span class="tc">完成</span>';
  document.getElementById('dr-save').setAttribute('data-result', '1');
}

function runGenerate() {
  if (!genForm.courseId || !genForm.chapterId || !genForm.lessonId) {
    document.getElementById('dr-err').textContent = sc('请选择 法本 / 章 / 课时', '請選擇 法本 / 章 / 課時');
    return;
  }
  var passage = document.getElementById('g-passage').value.trim();
  if (passage.length < 20) {
    document.getElementById('dr-err').textContent = sc('法本原文至少 20 字', '法本原文至少 20 字');
    return;
  }
  var errEl = document.getElementById('dr-err');
  errEl.textContent = '';

  var btn = document.getElementById('dr-save');
  btn.disabled = true;
  document.getElementById('dr-body').innerHTML =
    '<div class="gen-loading">' +
      '<span class="spin"></span>' +
      escapeHtml(sc('正在召唤 LLM 生成题目，约需 10-30 秒…', '正在召喚 LLM 生成題目，約需 10-30 秒…')) +
    '</div>';

  window.JX.api.post('/api/coach/questions/generate', {
    courseId: genForm.courseId,
    chapterId: genForm.chapterId,
    lessonId: genForm.lessonId,
    passage: passage,
    type: genForm.type,
    count: genForm.count,
    difficulty: genForm.difficulty,
    visibility: 'public',
  }).then(function (result) {
    // 把新题 unshift 进 list state
    (result.questions || []).forEach(function (q) { state.all.unshift(q); });
    renderList();
    renderGenerateResult(result);
    btn.disabled = false;
  }).catch(function (err) {
    btn.disabled = false;
    var s = err && err.status;
    var msg;
    if (s === 502 || s === 503) msg = sc('LLM 服务暂不可用（可能 API key 未配置或额度耗尽）', 'LLM 服務暫不可用（可能 API key 未配置或額度耗盡）');
    else msg = sc('生成失败：', '生成失敗：') + (err && err.message || err);
    renderGenerateForm();
    document.getElementById('dr-err').textContent = msg;
  });
}

document.getElementById('btn-generate').addEventListener('click', openGenerateDrawer);

// ── 批量导入 (3f) ────────────────────────────────
var BATCH_SAMPLE_ITEM = {
  courseId: '（从 URL 或 Prisma Studio 查）',
  chapterId: '（同上）',
  lessonId: '（同上）',
  type: 'single',
  visibility: 'public',
  questionText: '示例：菩提心最核心的愿心是？',
  correctText: '菩提心即为利众生愿成佛之心',
  wrongText: '',
  source: '《入菩萨行论》第一品',
  difficulty: 2,
  tags: ['菩提心'],
  payload: {
    options: [
      { text: '为利众生愿成佛', correct: true },
      { text: '仅求自己解脱', correct: false },
    ],
  },
};

function renderBatchForm() {
  var body = document.getElementById('dr-body');
  body.innerHTML =
    '<p class="f-hint" style="margin-bottom:var(--sp-3);line-height:1.7;">' +
      escapeHtml(sc(
        'JSON 数组，每项结构同「新建单题」的 body。支持最多 200 条。',
        'JSON 陣列，每項結構同「新建單題」的 body。支持最多 200 條。',
      )) +
    '</p>' +
    '<div class="f-row">' +
      '<label>' +
        '<input type="checkbox" id="b-partial" checked style="margin-right:6px;">' +
        escapeHtml(sc('容错模式（单条失败不阻断整批）', '容錯模式（單條失敗不阻斷整批）')) +
      '</label>' +
      '<p class="f-hint">' + escapeHtml(sc('关闭则任一失败整批回滚', '關閉則任一失敗整批回滾')) + '</p>' +
    '</div>' +
    '<div class="f-row">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<label style="margin-bottom:0;">' + escapeHtml(sc('条目 JSON', '條目 JSON')) + '</label>' +
        '<button type="button" class="f-add-opt" id="b-fill-sample" style="margin:0;padding:3px 10px;">' +
          escapeHtml(sc('填入样例', '填入樣例')) + '</button>' +
      '</div>' +
      '<textarea class="f-area" id="b-items" rows="16" style="font-family:\'SF Mono\',ui-monospace,monospace;font-size:.75rem;" placeholder="[ { &quot;type&quot;: &quot;single&quot;, ... } ]"></textarea>' +
      '<p class="f-hint" id="b-status">—</p>' +
    '</div>';

  document.getElementById('b-fill-sample').addEventListener('click', function () {
    document.getElementById('b-items').value = JSON.stringify([BATCH_SAMPLE_ITEM], null, 2);
    updateBatchStatus();
  });
  document.getElementById('b-items').addEventListener('input', updateBatchStatus);
  updateBatchStatus();
}

function updateBatchStatus() {
  var raw = (document.getElementById('b-items').value || '').trim();
  var statusEl = document.getElementById('b-status');
  if (!raw) { statusEl.textContent = sc('待粘贴 JSON', '待貼上 JSON'); return; }
  try {
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr)) { statusEl.textContent = sc('不是数组', '不是陣列'); return; }
    statusEl.textContent = sc('已识别 ', '已辨識 ') + arr.length + sc(' 条', ' 條');
  } catch (e) {
    statusEl.textContent = sc('JSON 解析失败：', 'JSON 解析失敗：') + e.message;
  }
}

function openBatchDrawer() {
  state.drawerMode = 'batch';
  state.currentQid = null;

  document.getElementById('dr-type').textContent = '📥';
  var statusEl = document.getElementById('dr-status');
  statusEl.className = 'q-status pending';
  statusEl.textContent = sc('批量', '批量');
  document.getElementById('dr-err').textContent = '';
  document.getElementById('dr-delete').style.display = 'none';
  document.getElementById('dr-edit').style.display = 'none';
  document.getElementById('dr-save').style.display = '';
  document.getElementById('dr-save').innerHTML = '<span class="sc">导入</span><span class="tc">匯入</span>';

  renderBatchForm();

  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('open');
  document.getElementById('drawer').setAttribute('aria-hidden', 'false');
}

function renderBatchResult(result) {
  state.drawerMode = 'batch-done';
  var body = document.getElementById('dr-body');
  var ok = result.succeeded, fail = result.failed, tot = result.total;
  var klass = fail > 0 ? 'gen-summary has-err' : 'gen-summary';
  var summary =
    '<p style="font-weight:700;margin-bottom:6px;">' +
      escapeHtml(sc('共 ', '共 ')) + tot +
      escapeHtml(sc(' 条 · 成功 ', ' 條 · 成功 ')) + ok +
      escapeHtml(sc(' · 失败 ', ' · 失敗 ')) + fail +
    '</p>' +
    '<p style="color:var(--ink-3);">' +
      escapeHtml(sc('public 题进入待审，class_private 题立即生效', 'public 題進入待審，class_private 題立即生效')) +
    '</p>';

  var items = (result.items || []).map(function (it) {
    if (it.ok) {
      return '<div class="gen-ok-item"><b>✓ #' + it.index + '</b> id:<code>' + escapeHtml((it.id || '').slice(-8)) + '</code></div>';
    }
    return '<div class="gen-skip-item"><b>✗ #' + it.index + '</b> ' + escapeHtml(it.error || '未知错误') + '</div>';
  }).join('');

  body.innerHTML = '<div class="' + klass + '">' + summary + '</div>' +
    (items ? '<h3>' + escapeHtml(sc('逐条结果', '逐條結果')) + '</h3>' + items : '');

  document.getElementById('dr-save').innerHTML = '<span class="sc">完成</span><span class="tc">完成</span>';
}

function runBatch() {
  var errEl = document.getElementById('dr-err');
  errEl.textContent = '';
  var raw = (document.getElementById('b-items').value || '').trim();
  if (!raw) { errEl.textContent = sc('请粘贴 JSON 数组', '請貼上 JSON 陣列'); return; }
  var items;
  try { items = JSON.parse(raw); }
  catch (e) { errEl.textContent = sc('JSON 解析失败：', 'JSON 解析失敗：') + e.message; return; }
  if (!Array.isArray(items) || !items.length) { errEl.textContent = sc('需要一个非空数组', '需要一個非空陣列'); return; }
  if (items.length > 200) { errEl.textContent = sc('最多 200 条/批', '最多 200 條/批'); return; }
  var partial = document.getElementById('b-partial').checked;

  var btn = document.getElementById('dr-save');
  btn.disabled = true;
  document.getElementById('dr-body').innerHTML =
    '<div class="gen-loading"><span class="spin"></span>' +
      escapeHtml(sc('正在导入…', '正在匯入…')) +
    '</div>';

  window.JX.api.post('/api/coach/questions/batch', { partial: partial, items: items })
    .then(function (result) {
      (result.questions || []).forEach(function (q) { state.all.unshift(q); });
      renderList();
      renderBatchResult(result);
      btn.disabled = false;
    })
    .catch(function (err) {
      btn.disabled = false;
      renderBatchForm();
      // strict 模式整批失败 → 400；partial 模式下一般不会走到这里
      if (err && err.details && err.details.fieldErrors) {
        errEl.textContent = sc('参数校验失败：', '參數校驗失敗：') + JSON.stringify(err.details.fieldErrors).slice(0, 200);
      } else {
        errEl.textContent = sc('导入失败：', '匯入失敗：') + (err && err.message || err);
      }
    });
}

document.getElementById('btn-batch').addEventListener('click', openBatchDrawer);

document.getElementById('dr-save').addEventListener('click', function () {
  var btn = this;
  var errEl = document.getElementById('dr-err');

  // 3e: LLM 生成流
  if (state.drawerMode === 'generate') { runGenerate(); return; }
  if (state.drawerMode === 'generate-done') { closeDrawer(); return; }
  // 3f: 批量导入流
  if (state.drawerMode === 'batch') { runBatch(); return; }
  if (state.drawerMode === 'batch-done') { closeDrawer(); return; }

  errEl.textContent = '';
  var body;
  try { body = collectCreateBody(); }
  catch (e) { errEl.textContent = e.message; return; }
  btn.disabled = true;

  if (state.drawerMode === 'edit') {
    // PATCH 只送后端允许的字段（不含 location）
    var patchBody = {
      type: body.type,
      questionText: body.questionText,
      correctText: body.correctText,
      wrongText: body.wrongText,
      source: body.source,
      difficulty: body.difficulty,
      tags: body.tags,
      payload: body.payload,
    };
    window.JX.api.patch('/api/coach/questions/' + encodeURIComponent(state.currentQid), patchBody)
      .then(function (updated) {
        var idx = state.all.findIndex(function (r) { return r.id === updated.id; });
        if (idx >= 0) state.all[idx] = updated;
        renderList();
        closeDrawer();
      })
      .catch(function (err) {
        var s = err && err.status;
        errEl.textContent = s === 403
          ? sc('无权编辑此题（已通过审核）', '無權編輯此題（已通過審核）')
          : (sc('保存失败：', '保存失敗：') + (err && err.message || err));
      })
      .finally(function () { btn.disabled = false; });
  } else {
    window.JX.api.post('/api/coach/questions', body)
      .then(function (q) {
        state.all.unshift(q);
        renderList();
        closeDrawer();
      })
      .catch(function (err) {
        errEl.textContent = sc('保存失败：', '保存失敗：') + (err && err.message || err);
      })
      .finally(function () { btn.disabled = false; });
  }
});

// 行点击 → 打开抽屉
document.getElementById('list-body').addEventListener('click', function (ev) {
  var tr = ev.target.closest('tr[data-row]');
  if (!tr) return;
  openDrawer(tr.getAttribute('data-qid'));
});

// Filters
document.getElementById('status-chips').addEventListener('click', function (ev) {
  var chip = ev.target.closest('.fchip');
  if (!chip) return;
  document.querySelectorAll('#status-chips .fchip').forEach(function (c) { c.classList.remove('active'); });
  chip.classList.add('active');
  state.statusFilter = chip.getAttribute('data-status');
  renderList();
});
document.getElementById('type-select').addEventListener('change', function (ev) {
  state.typeFilter = ev.target.value;
  renderList();
});
var searchDebounce;
document.getElementById('search-input').addEventListener('input', function (ev) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(function () {
    state.search = ev.target.value;
    renderList();
  }, 120);
});

document.getElementById('btn-logout').addEventListener('click', function () {
  if (!confirm(sc('确定退出登录？', '確定退出登入？'))) return;
  window.JX.api.logout().finally(function () { location.replace('../mobile/auth.html'); });
});

document.addEventListener('jx:user-ready', boot);
document.addEventListener('langchange', renderList);
if (window.JX && window.JX.user) boot();
})();
