// BrainBase — app.js v3
// Alpine.js メインロジック
// Claude Code 自動連携対応 (APIモード / IndexedDBフォールバック)

const API_BASE = 'http://localhost:3001';

function brainbase() {
  return {
    // ===== ナビ =====
    currentPage: 'today',
    pageTitles: { today:'Today', tasks:'Tasks', ideas:'Ideas', post:'Post', settings:'Settings' },

    // ===== APIモード =====
    isApiMode: false,

    // ===== データ =====
    businesses:  [],
    goals:       [],
    tasks:       [],
    ideas:       [],
    drafts:      [],
    settings: { claudeKey: '', githubToken: '' },

    // ===== Tasks タブ =====
    taskTab:      'tasks',
    activeFilter: 'all',
    taskFilters: [
      { key:'all', label:'すべて' },
      { key:'today', label:'今日' },
      { key:'active', label:'未完了' },
      { key:'done', label:'完了済み' },
    ],

    // ===== フォーム =====
    newTask:  { title:'', project:'', businessId:'', goalId:'', priority:'normal', dueDate:'' },
    newIdea:  { title:'', body:'' },
    newDraft: { body:'' },
    newGoal:  { title:'', businessId:'', targetDate:'' },
    newBusiness: { name:'', color:'#7C5CFC', icon:'🏢' },

    // ===== モーダル =====
    showAddModal:      false,
    showGoalModal:     false,
    showProgressModal: false,
    showBusinessModal: false,
    editingGoal:       null,
    editingProgress:   0,

    // ===== AI Today タスク =====
    aiSuggestedTasks: [],
    aiTasksLoading:   false,
    aiTasksGenerated: false,

    // ===== Magic Project =====
    showMagicModal: false,
    magicInput:     '',
    magicResult:    null,
    magicLoading:   false,

    // ===== Today stats =====
    todayStats: { tasks:0, done:0, ideas:0 },
    todayDateStr: '',
    greetingText: '',

    // ===== Toast =====
    toast: { show:false, message:'', type:'info', timer:null },

    // ================================================
    // INIT
    // ================================================
    async init() {
      this.setDateAndGreeting();

      const hash = window.location.hash.slice(1);
      if (hash && this.pageTitles[hash]) this.currentPage = hash;
      window.addEventListener('hashchange', () => {
        const p = window.location.hash.slice(1);
        if (p && this.pageTitles[p]) {
          this.currentPage = p;
          this.$nextTick(() => lucide.createIcons());
        }
      });

      // localhostからのアクセス時のみAPIチェック（スマホ・GitHub Pagesはスキップ）
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        await this.checkApiConnection(true);
      }

      if (!this.isApiMode) {
        await db.open();
        await this.seedBusinesses();
      }

      await this.loadAll();
      this.$nextTick(() => lucide.createIcons());
    },

    async checkApiConnection(silent = false) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 1000);
        const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
        clearTimeout(timer);
        this.isApiMode = res.ok;
        if (!silent) this.showToast(res.ok ? 'サーバーに接続しました 🟢' : '接続失敗 🔴', res.ok ? 'info' : 'error');
      } catch {
        this.isApiMode = false;
        if (!silent) this.showToast('サーバーが起動していません 🔴', 'error');
      }
    },

    async seedBusinesses() {
      const count = await db.businesses.count();
      if (count === 0) {
        await db.businesses.bulkAdd([
          { name:'住まいセレクト',   color:'#FF6B47', icon:'🏠', createdAt: new Date() },
          { name:'不動産広告代理',   color:'#F59E0B', icon:'📢', createdAt: new Date() },
          { name:'AI導入支援',      color:'#7C5CFC', icon:'🤖', createdAt: new Date() },
          { name:'BrainBase',      color:'#22C55E', icon:'🧠', createdAt: new Date() },
        ]);
      }
    },

    // ================================================
    // データ読み込み
    // ================================================
    async loadAll() {
      if (this.isApiMode) {
        await this.loadAllFromApi();
      } else {
        await this.loadAllFromDb();
      }
    },

    async loadAllFromApi() {
      try {
        const [businesses, goals, tasks, ideas] = await Promise.all([
          fetch(`${API_BASE}/api/businesses`).then(r => r.json()),
          fetch(`${API_BASE}/api/goals`).then(r => r.json()),
          fetch(`${API_BASE}/api/tasks`).then(r => r.json()),
          fetch(`${API_BASE}/api/ideas`).then(r => r.json()),
        ]);
        this.businesses = businesses || [];
        this.goals      = goals     || [];
        this.tasks      = tasks     || [];
        this.ideas      = ideas     || [];
        this.drafts     = [];
      } catch {
        this.isApiMode = false;
        await db.open();
        await this.loadAllFromDb();
        return;
      }
      this.todayStats.tasks = this.tasks.filter(t => !t.done).length;
      this.todayStats.done  = this.tasks.filter(t => t.done).length;
      this.todayStats.ideas = this.ideas.length;
      this.$nextTick(() => lucide.createIcons());
    },

    async loadAllFromDb() {
      this.businesses = await db.businesses.toArray();
      this.goals      = await db.goals.orderBy('createdAt').reverse().toArray();
      this.tasks      = await db.tasks.orderBy('createdAt').reverse().toArray();
      this.ideas      = await db.ideas.orderBy('createdAt').reverse().toArray();
      this.drafts     = await db.drafts.orderBy('createdAt').reverse().toArray();

      const s = await db.settings.get(1);
      if (s) {
        this.settings.claudeKey   = s.claudeKey   || '';
        this.settings.githubToken = s.githubToken || '';
      }

      this.todayStats.tasks = this.tasks.filter(t => !t.done).length;
      this.todayStats.done  = this.tasks.filter(t => t.done).length;
      this.todayStats.ideas = this.ideas.length;
      this.$nextTick(() => lucide.createIcons());
    },

    // ================================================
    // ナビゲーション
    // ================================================
    navigate(page) {
      this.currentPage = page;
      window.location.hash = page;
      this.showAddModal = false;
      this.showMagicModal = false;
      this.$nextTick(() => lucide.createIcons());
    },

    // ================================================
    // 事業 (Businesses)
    // ================================================
    businessById(id) {
      return this.businesses.find(b => b.id === Number(id)) || null;
    },

    goalsForBusiness(businessId) {
      return this.goals.filter(g => g.businessId === businessId);
    },

    businessProgress(businessId) {
      const gs = this.goalsForBusiness(businessId);
      if (!gs.length) return 0;
      return Math.round(gs.reduce((s, g) => s + (g.progress || 0), 0) / gs.length);
    },

    tasksForBusiness(businessId) {
      return this.tasks.filter(t => t.businessId === businessId && !t.done).length;
    },

    async addBusiness() {
      if (!this.newBusiness.name.trim()) return;
      if (this.isApiMode) {
        this.showToast('APIモードでは事業追加はサーバー側で管理されます', 'error');
        return;
      }
      await db.businesses.add({
        name: this.newBusiness.name.trim(),
        color: this.newBusiness.color,
        icon: this.newBusiness.icon,
        createdAt: new Date(),
      });
      this.newBusiness = { name:'', color:'#7C5CFC', icon:'🏢' };
      this.showBusinessModal = false;
      await this.loadAll();
      this.showToast('事業を追加しました');
    },

    // ================================================
    // GOALS CRUD
    // ================================================
    openGoalModal(businessId = '') {
      this.newGoal = { title:'', businessId: businessId || '', targetDate:'' };
      this.showGoalModal = true;
      this.$nextTick(() => lucide.createIcons());
    },

    async addGoal() {
      if (!this.newGoal.title.trim() || !this.newGoal.businessId) return;
      if (this.isApiMode) {
        await fetch(`${API_BASE}/api/goals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:      this.newGoal.title.trim(),
            businessId: Number(this.newGoal.businessId),
            targetDate: this.newGoal.targetDate,
          }),
        });
      } else {
        await db.goals.add({
          title:      this.newGoal.title.trim(),
          businessId: Number(this.newGoal.businessId),
          targetDate: this.newGoal.targetDate,
          progress:   0,
          status:     'active',
          createdAt:  new Date(),
        });
      }
      this.showGoalModal = false;
      this.aiTasksGenerated = false;
      await this.loadAll();
      this.showToast('ゴールを設定しました');
    },

    openProgressModal(goal) {
      this.editingGoal     = goal;
      this.editingProgress = goal.progress || 0;
      this.showProgressModal = true;
    },

    async saveProgress() {
      if (!this.editingGoal) return;
      if (!this.isApiMode) {
        await db.goals.update(this.editingGoal.id, { progress: Number(this.editingProgress) });
      }
      this.showProgressModal = false;
      this.editingGoal = null;
      await this.loadAll();
      this.showToast('進捗を更新しました');
    },

    async deleteGoal(id) {
      if (!this.isApiMode) await db.goals.delete(id);
      await this.loadAll();
      this.showToast('削除しました');
    },

    // ================================================
    // AI 今日のタスク自動生成
    // ================================================
    async generateAITasks() {
      if (!this.settings.claudeKey) {
        this.showToast('Claude APIキーを設定してください', 'error');
        return;
      }
      const activeGoals = this.goals.filter(g => g.status === 'active');
      if (!activeGoals.length) {
        this.showToast('まずゴールを設定してください', 'error');
        return;
      }
      this.aiTasksLoading = true;
      this.aiSuggestedTasks = [];
      const today = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
      const goalLines = activeGoals.map(g => {
        const biz = this.businessById(g.businessId);
        return `- [${biz ? biz.name : '不明'}(id:${g.businessId})] "${g.title}" 進捗:${g.progress||0}% 期限:${g.targetDate||'未設定'} goalId:${g.id}`;
      }).join('\n');
      const prompt = `あなたは一人社長のタスクアシスタントです。\n今日の日付：${today}\n\nアクティブなゴール一覧：\n${goalLines}\n\nこれらのゴールの進捗を前進させるために、今日やるべき具体的なタスクを4〜5個提案してください。各タスクは30分〜2時間で完了できる粒度にしてください。\n\n以下のJSON形式のみで返してください（説明文不要）：\n{\n  "tasks": [\n    {\n      "title": "具体的なタスク名",\n      "businessId": 事業ID（数字）,\n      "goalId": ゴールID（数字）,\n      "priority": "high|normal|low",\n      "reason": "今日やる理由（20字以内）"\n    }\n  ]\n}`;
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.settings.claudeKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1024, messages: [{ role:'user', content: prompt }] }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'API Error'); }
        const data = await res.json();
        const text = data.content[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON形式で返ってきませんでした');
        const parsed = JSON.parse(jsonMatch[0]);
        this.aiSuggestedTasks = (parsed.tasks || []).map(t => ({ ...t, adopted: false }));
        this.aiTasksGenerated = true;
        this.$nextTick(() => lucide.createIcons());
      } catch (e) {
        this.showToast('エラー: ' + e.message, 'error');
      } finally {
        this.aiTasksLoading = false;
      }
    },

    async adoptAITask(task, index) {
      const taskData = { title: task.title, businessId: Number(task.businessId), goalId: Number(task.goalId), project: this.businessById(task.businessId)?.name || '', priority: task.priority || 'normal', dueDate: new Date().toISOString().slice(0, 10), done: false, source: 'manual', createdAt: new Date() };
      if (this.isApiMode) { await fetch(`${API_BASE}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) }); }
      else { await db.tasks.add(taskData); }
      this.aiSuggestedTasks[index].adopted = true;
      await this.loadAll();
      this.showToast('タスクに追加しました');
    },

    async adoptAllAITasks() {
      for (const t of this.aiSuggestedTasks.filter(t => !t.adopted)) {
        const taskData = { title: t.title, businessId: Number(t.businessId), goalId: Number(t.goalId), project: this.businessById(t.businessId)?.name || '', priority: t.priority || 'normal', dueDate: new Date().toISOString().slice(0, 10), done: false, source: 'manual', createdAt: new Date() };
        if (this.isApiMode) { await fetch(`${API_BASE}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) }); }
        else { await db.tasks.add(taskData); }
      }
      this.aiSuggestedTasks = this.aiSuggestedTasks.map(t => ({ ...t, adopted: true }));
      await this.loadAll();
      this.showToast('すべてのタスクを追加しました');
    },

    // ================================================
    // TASKS CRUD
    // ================================================
    get filteredTasks() {
      const f = this.activeFilter;
      const todayStr = new Date().toISOString().slice(0, 10);
      if (f === 'today')  return this.tasks.filter(t => t.dueDate === todayStr);
      if (f === 'active') return this.tasks.filter(t => !t.done);
      if (f === 'done')   return this.tasks.filter(t => t.done);
      return this.tasks;
    },

    get todayTasks() {
      const todayStr = new Date().toISOString().slice(0, 10);
      return this.tasks.filter(t => t.dueDate === todayStr).slice(0, 6);
    },

    openAddModal() {
      this.newTask  = { title:'', project:'', businessId:'', goalId:'', priority:'normal', dueDate:'' };
      this.newIdea  = { title:'', body:'' };
      this.newDraft = { body:'' };
      this.showAddModal = true;
      this.$nextTick(() => lucide.createIcons());
    },

    addModalTitle() {
      const m = { today:'タスクを追加', tasks:'タスクを追加', ideas:'アイデアを追加', post:'下書きを作成' };
      return m[this.currentPage] || '追加';
    },

    async addTask() {
      if (!this.newTask.title.trim()) return;
      const taskData = {
        title:      this.newTask.title.trim(),
        project:    this.newTask.project.trim() || (this.businessById(this.newTask.businessId)?.name || ''),
        businessId: this.newTask.businessId ? Number(this.newTask.businessId) : null,
        goalId:     this.newTask.goalId ? Number(this.newTask.goalId) : null,
        priority:   this.newTask.priority,
        dueDate:    this.newTask.dueDate,
        done:       false,
        source:     'manual',
        createdAt:  new Date(),
      };
      if (this.isApiMode) {
        await fetch(`${API_BASE}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) });
      } else {
        await db.tasks.add(taskData);
      }
      await this.loadAll();
      this.showAddModal = false;
      this.showToast('タスクを追加しました');
    },

    goalsForSelectedBusiness() {
      if (!this.newTask.businessId) return [];
      return this.goals.filter(g => g.businessId === Number(this.newTask.businessId));
    },

    async toggleTask(id) {
      if (this.isApiMode) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;
        if (!task.done) { await fetch(`${API_BASE}/api/tasks/${id}/complete`, { method: 'PUT' }); }
        else { this.tasks = this.tasks.map(t => t.id === id ? { ...t, done: false } : t); return; }
      } else {
        const t = await db.tasks.get(id);
        if (!t) return;
        await db.tasks.update(id, { done: !t.done });
      }
      await this.loadAll();
    },

    async deleteTask(id) {
      if (this.isApiMode) { await fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' }); }
      else { await db.tasks.delete(id); }
      await this.loadAll();
      this.showToast('削除しました');
    },

    // ================================================
    // IDEAS CRUD
    // ================================================
    async addIdea() {
      if (!this.newIdea.title.trim()) return;
      if (this.isApiMode) {
        await fetch(`${API_BASE}/api/ideas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: this.newIdea.title.trim(), body: this.newIdea.body.trim() }) });
      } else {
        await db.ideas.add({ title: this.newIdea.title.trim(), body: this.newIdea.body.trim(), converted: false, createdAt: new Date() });
      }
      await this.loadAll();
      this.showAddModal = false;
      this.showToast('アイデアを保存しました');
    },

    async deleteIdea(id) {
      if (!this.isApiMode) await db.ideas.delete(id);
      await this.loadAll();
      this.showToast('削除しました');
    },

    // ================================================
    // DRAFTS CRUD
    // ================================================
    async addDraft() {
      if (!this.newDraft.body.trim()) return;
      if (!this.isApiMode) { await db.drafts.add({ body: this.newDraft.body.trim(), createdAt: new Date() }); }
      await this.loadAll();
      this.showAddModal = false;
      this.showToast('下書きを保存しました');
    },

    copyDraft(draft) {
      navigator.clipboard.writeText(draft.body).then(() => this.showToast('コピーしました')).catch(() => this.showToast('コピー失敗', 'error'));
    },

    postToX(draft) {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(draft.body)}`, '_blank');
    },

    // ================================================
    // MAGIC PROJECT
    // ================================================
    async runMagicProject() {
      if (!this.magicInput.trim() || !this.settings.claudeKey) return;
      this.magicLoading = true;
      this.magicResult  = null;
      const prompt = `以下のアイデアを実現するプロジェクト計画をJSON形式で返してください。\n\nアイデア: ${this.magicInput}\n\nJSON形式のみ（説明不要）：\n{\n  "projectName": "プロジェクト名",\n  "summary": "一行説明",\n  "tasks": [\n    { "title": "タスク名", "priority": "high|normal|low", "estimatedDays": 数字 }\n  ]\n}`;
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': this.settings.claudeKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model:'claude-haiku-4-5', max_tokens:1024, messages:[{role:'user',content:prompt}] }) });
        const data = await res.json();
        const text = data.content[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        this.magicResult = JSON.parse(jsonMatch[0]);
        this.$nextTick(() => lucide.createIcons());
      } catch(e) {
        this.showToast('エラー: ' + e.message, 'error');
      } finally {
        this.magicLoading = false;
      }
    },

    async adoptMagicResult() {
      if (!this.magicResult) return;
      for (const t of this.magicResult.tasks) {
        const taskData = { title: t.title, project: this.magicResult.projectName, priority: t.priority || 'normal', dueDate: '', done: false, source: 'manual', createdAt: new Date() };
        if (this.isApiMode) { await fetch(`${API_BASE}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData) }); }
        else { await db.tasks.add(taskData); }
      }
      await this.loadAll();
      this.showMagicModal = false;
      const count = this.magicResult?.tasks?.length || '';
      this.magicResult = null;
      this.magicInput  = '';
      this.navigate('tasks');
      this.showToast(`${count}個のタスクを追加しました`);
    },

    // ================================================
    // SETTINGS
    // ================================================
    async saveSettings() {
      if (!this.isApiMode) {
        await db.settings.put({ id:1, claudeKey: this.settings.claudeKey, githubToken: this.settings.githubToken });
      }
      this.showToast('保存しました');
    },

    async resetAllData() {
      if (!confirm('すべてのデータを削除します。この操作は取り消せません。')) return;
      if (!this.isApiMode) {
        await Promise.all([db.tasks.clear(), db.ideas.clear(), db.drafts.clear(), db.goals.clear(), db.businesses.clear(), db.settings.clear()]);
        this.settings = { claudeKey:'', githubToken:'' };
        await this.seedBusinesses();
      }
      await this.loadAll();
      this.showToast('データを削除しました');
    },

    // ================================================
    // UTILS
    // ================================================
    formatDate(date) {
      if (!date) return '';
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '';
      const diff = Date.now() - d.getTime();
      if (diff < 60000)    return 'たった今';
      if (diff < 3600000)  return Math.floor(diff/60000) + '分前';
      if (diff < 86400000) return Math.floor(diff/3600000) + '時間前';
      return `${d.getMonth()+1}/${d.getDate()}`;
    },

    setDateAndGreeting() {
      const now  = new Date();
      const days = ['日','月','火','水','木','金','土'];
      this.todayDateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日（${days[now.getDay()]}）`;
      const h = now.getHours();
      if (h < 5)       this.greetingText = 'お疲れさまです 🌙';
      else if (h < 12) this.greetingText = 'おはようございます ☀️';
      else if (h < 17) this.greetingText = 'こんにちは 🌤';
      else if (h < 21) this.greetingText = 'お疲れさまです 🌆';
      else             this.greetingText = 'お疲れさまでした 🌙';
    },

    showToast(message, type = 'info') {
      if (this.toast.timer) clearTimeout(this.toast.timer);
      this.toast = { show:true, message, type, timer:null };
      this.toast.timer = setTimeout(() => { this.toast.show = false; }, 2500);
    },
  };
}
