# BrainBase サーバー セットアップガイド

Claude CodeとBrainBaseを自動連携するためのローカルAPIサーバーです。

## アーキテクチャ

```
Claude Code
    ↓ フック（PreToolUse/PostToolUse）
hook-handler.js（stdinからJSON受け取り）
    ↓ HTTP POST
ローカルAPIサーバー（localhost:3001）
    ↓
SQLiteファイル（tasks.db）
    ↑ HTTP GET/POST
Brainbaseブラウザアプリ
```

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
cd server
npm install
```

### 2. サーバーの起動

```bash
node api.js
```

ターミナルに以下が表示されれば起動成功です：
```
BrainBase API server running on http://localhost:3001
Health check: http://localhost:3001/api/health
```

### 3. 動作確認

ブラウザで `http://localhost:3001/api/health` にアクセスし、以下のようなJSONが返ればOKです：

```json
{ "ok": true, "timestamp": "2024-01-01T00:00:00.000Z" }
```

BrainBaseアプリ（`index.html`）を開くと、設定画面に「Claude Code連携: ローカルサーバー接続中 🟢」と表示されます。

### 4. Claude Code のフック設定

`~/.claude/settings.json` に以下を追加してください。
`/path/to/brainbase` はこのリポジトリをクローンしたパスに置き換えてください。

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "HOOK_EVENT=PreToolUse node /path/to/brainbase/server/hook-handler.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "HOOK_EVENT=PostToolUse node /path/to/brainbase/server/hook-handler.js"
          }
        ]
      }
    ]
  }
}
```

設定後、Claude Codeでファイルを編集・作成すると、BrainBaseのタスク一覧に自動でタスクが追加・完了されます。

## API エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | /api/health | ヘルスチェック |
| GET | /api/businesses | 事業一覧 |
| GET | /api/tasks | タスク一覧（?date=, ?done= 対応） |
| POST | /api/tasks | タスク追加 |
| PUT | /api/tasks/:id/complete | タスク完了 |
| DELETE | /api/tasks/:id | タスク削除 |
| GET | /api/ideas | アイデア一覧 |
| POST | /api/ideas | アイデア追加 |
| GET | /api/goals | ゴール一覧 |
| POST | /api/goals | ゴール追加 |
| GET | /api/stats | 統計情報 |

## データファイル

SQLiteデータベースは `server/tasks.db` に保存されます。  
このファイルは `.gitignore` に追加されているため、Gitには含まれません。
