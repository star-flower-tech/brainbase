// BrainBase — app.js
// Alpine.js メインアプリロジック + ハッシュルーティング

function brainbase() {
  return {
    // ===== ナビゲーション =====
    currentPage: 'today',
    pageTitles: {
      today:    'Today',
      tasks:    'Tasks',
      ideas:    'Ideas',
      post:     'Post',
      settings: 'Settings',
    },

    // ===== データ =====
    tasks:       [],
    ideas:       [],
    drafts:      [],
    todayTasks:  [],
    recentIdeas: [],
    settings: {
      claudeKey:   '',
      githubToken: '',
    },

    // ===== フィルター =====
    taskFilters: [
      { key: 'all',     label: 'すべて' },
      { key: 'today',   label: '今日' },
      { key: 'active',  label: '未完了' },
      { key: 'done',    label: '完了済み' },
    ],
    activeFilter: 'all',

    // ===== フォーム =====
    newTask:  { title: '', project: '', priority: 'normal', dueDate: '' },
    newIdea:  { title: '', body: '' },
    newDraft: { body: '' },

    // ===== モーダル =====
    showAddModal:   false,
    showMagicModal: false,

    // ===== Magic Project =====
    magicInput:  '',
    magicResult: null,
    magicLoading: false,

    // ===== Today stats =====
    todayStats: { tasks: 0, done: 0, ideas: 0 },

    // ===== Toast =====
    toast: { show: false, message: '', type: 'info', timer: null },

    // ===== 今日の日付 =====
    todayDateStr: '',
    greetingText: '',

    // ================================================
    // INIT
    // ================================================
    async init() {
      // 日付・挨拶
      this.setDateAndGreeting();

      // ハッシュルーティング
      const hash = window.location.hash.slice(1);
      if (hash && this.pageTitles[hash]) {
        this.currentPage = hash;
      }
      window.addEventListener('hashchange', () => {
        const page = window.location.hash.slice(1);
        if (page && this.pageTitles[page]) {
          this.currentPage = page;
          this.$nextTick(() => lucide.createIcons());
        }
      });

      // DB初期化待ち
      await db.open();

      // データロード
      await this.loadAll();

      // Lucideアイコン描画
      this.$nextTick(() => lucide.createIcons());
    },

    // ================================================
    // データ読み込み
    // ================================================
    async loadAll() {
      this.tasks  = await db.tasks.orderBy('createdAt').reverse().toArray();
      this.ideas  = await db.ideas.orderBy('createdAt').reverse().toArray();
      this.drafts = await db.drafts.orderBy('createdAt').reverse().toArray();

      // Settings
      const s = await db.settings.get(1);
      if (s) {
        this.settings.claudeKey   = s.claudeKey   || '';
        this.settings.githubToken = s.githubToken || '';
      }

      // Today用データ
      const todayStr = new Date().toISOString().slice(0, 10);
      this.todayTasks  = this.tasks.filter(t => t.dueDate === todayStr || !t.dueDate).slice(0, 5);
      this.recentIdeas = this.ideas.slice(0, 3);

      // Stats
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
      this.showAddModal   = false;
      this.showMagicModal = false;
      this.$nextTick(() => lucide.createIcons());
    },

    // ================================================
    // FAB — ページに応じてモーダルを開く
    // ================================================
    openAddModal() {
      this.newTask  = { title: '', project: '', priority: 'normal', dueDate: '' };
      this.newIdea  = { title: '', body: '' };
      this.newDraft = { body: '' };
      this.showAddModal = true;
      this.$nextTick(() => lucide.createIcons());
    },

    addModalTitle() {
      const map = {
        today:    'タスクを追加',
        tasks:    'タスクを追加',
        ideas:    'アイデアを追加',
        post:     '下書きを追加',
        settings: '',
      };
      return map[this.currentPage] || '追加';
    },

    // ================================================
    // TASKS CRUD
    // ================================================
    async addTask() {
      if (!this.newTask.title.trim()) return;
      const task = {
        title:     this.newTask.title.trim(),
        project:   this.newTask.project.trim(),
        priority:  this.newTask.priority,
        dueDate:   this.newTask.dueDate,
        done:      false,
        createdAt: new Date(),
      };
      await db.tasks.add(task);
      await this.loadAll();
      this.showAddModal = false;
      this.showToast('タスクを追加しました');
    },

    async toggleTask(id) {
      const task = await db.tasks.get(id);
      if (!task) return;
      await db.tasks.update(id, { done: !task.done });
      await this.loadAll();
    },

    async deleteTask(id) {
      await db.tasks.delete(id);
      await this.loadAll();
      this.showToast('削除しました');
    },

    get filteredTasks() {
      const f = this.activeFilter;
      const todayStr = new Date().toISOString().slice(0, 10);
      if (f === 'today')  return this.tasks.filter(t => t.dueDate === todayStr);
      if (f === 'active') return this.tasks.filter(t => !t.done);
      if (f === 'done')   return this.tasks.filter(t => t.done);
      return this.tasks;
    },

    // ================================================
    // IDEAS CRUD
    // ================================================
    async addIdea() {
      if (!this.newIdea.title.trim()) return;
      const idea = {
        title:     this.newIdea.title.trim(),
        body:      this.newIdea.body.trim(),
        converted: false,
        createdAt: new Date(),
      };
      await db.ideas.add(idea);
      await this.loadAll();
      this.showAddModal = false;
      this.showToast('アイデアを保存しました');
    },

    async deleteIdea(id) {
      await db.ideas.delete(id);
      await this.loadAll();
      this.showToast('削除しました');
    },

    // ================================================
    // DRAFTS CRUD
    // ================================================
    async addDraft() {
      if (!this.newDraft.body.trim()) return;
      const draft = {
        body:      this.newDraft.body.trim(),
        createdAt: new Date(),
      };
      await db.drafts.add(draft);
      await this.loadAll();
      this.showAddModal = false;
      this.showToast('下書きを保存しました');
    },

    copyDraft(draft) {
      navigator.clipboard.writeText(draft.body)
        .then(() => this.showToast('コピーしました'))
        .catch(() => this.showToast('コピー失敗', 'error'));
    },

    postToX(draft) {
      const text = encodeURIComponent(draft.body);
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    },

    // ================================================
    // SETTINGS
    // ================================================
    async saveSettings() {
      await db.settings.put({
        id:          1,
        claudeKey:   this.settings.claudeKey,
        githubToken: this.settings.githubToken,
      });
      this.showToast('保存しました');
    },

    async resetAllData() {
      if (!confirm('すべてのデータを削除します。この操作は取り消せません。')) return;
      await db.tasks.clear();
      await db.ideas.clear();
      await db.drafts.clear();
      await db.settings.clear();
      this.settings = { claudeKey: '', githubToken: '' };
      await this.loadAll();
      this.showToast('データを削除しました');
    },

    // ================================================
    // MAGIC PROJECT (Claude API BYOK)
    // ================================================
    async runMagicProject() {
      if (!this.magicInput.trim() || !this.settings.claudeKey) return;
      this.magicLoading = true;
      this.magicResult  = null;

      const prompt = `以下のアイデアを実現するためのプロジェクト計画をJSON形式で返してください。

アイデア: ${this.magicInput}

以下のJSON形式のみで返答してください（前後の説明不要）:
{
  "projectName": "プロジェクト名",
  "summary": "一行説明",
  "tasks": [
    { "title": "タスク名", "priority": "high|normal|low", "estimatedDays": 数字 },
    ...（3〜7個）
  ]
}`;

      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.settings.claudeKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || 'API Error');
        }

        const data = await res.json();
        const text = data.content[0].text.trim();

        // JSON部分を抽出
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSONが見つかりません');
        this.magicResult = JSON.parse(jsonMatch[0]);
        this.$nextTick(() => lucide.createIcons());

      } catch (e) {
        this.showToast('エラー: ' + e.message, 'error');
      } finally {
        this.magicLoading = false;
      }
    },

    async adoptMagicResult() {
      if (!this.magicResult) return;
      for (const t of this.magicResult.tasks) {
        await db.tasks.add({
          title:     t.title,
          project:   this.magicResult.projectName,
          priority:  t.priority || 'normal',
          dueDate:   '',
          done:      false,
          createdAt: new Date(),
        });
      }
      await this.loadAll();
      this.showMagicModal = false;
      this.magicResult    = null;
      this.magicInput     = '';
      this.navigate('tasks');
      this.showToast(`${this.magicResult?.tasks?.length || ''}個のタスクを追加しました`);
    },

    // ================================================
    // UTILS
    // ================================================
    formatDate(date) {
      if (!date) return '';
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d)) return '';
      const now = new Date();
      const diff = now - d;
      if (diff < 60000)    return 'たった今';
      if (diff < 3600000)  return Math.floor(diff / 60000) + '分前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + '時間前';
      return `${d.getMonth() + 1}/${d.getDate()}`;
    },

    setDateAndGreeting() {
      const now   = new Date();
      const days  = ['日', '月', '火', '水', '木', '金', '土'];
      const month = now.getMonth() + 1;
      const date  = now.getDate();
      const day   = days[now.getDay()];
      this.todayDateStr = `${now.getFullYear()}年${month}月${date}日（${day}）`;

      const hour = now.getHours();
      if (hour < 5)       this.greetingText = 'お疲れさまです 🌙';
      else if (hour < 12) this.greetingText = 'おはようございます ☀️';
      else if (hour < 17) this.greetingText = 'こんにちは 🌤';
      else if (hour < 21) this.greetingText = 'お疲れさまです 🌆';
      else                this.greetingText = 'お疲れさまでした 🌙';
    },

    showToast(message, type = 'info') {
      if (this.toast.timer) clearTimeout(this.toast.timer);
      this.toast = { show: true, message, type, timer: null };
      this.toast.timer = setTimeout(() => {
        this.toast.show = false;
      }, 2500);
    },
  };
}
