'use strict';

/**
 * Claude Code hook handler
 * stdinからJSONを受け取り、BrainBase APIにタスクを登録・完了する
 *
 * 環境変数:
 *   HOOK_EVENT=PreToolUse  → タスク追加
 *   HOOK_EVENT=PostToolUse → 直近のClaudeタスクを完了
 */

const http     = require('http');
const readline = require('readline');

const API_HOST = 'localhost';
const API_PORT = 3001;

// HTTP POSTヘルパー（依存ゼロ）
function httpPost(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: API_HOST,
      port:     API_PORT,
      path,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
    req.write(data);
    req.end();
  });
}

// HTTP GETヘルパー
function httpGet(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: API_HOST,
      port:     API_PORT,
      path,
      method:   'GET',
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// HTTP PUTヘルパー
function httpPut(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: API_HOST,
      port:     API_PORT,
      path,
      method:   'PUT',
      headers: { 'Content-Length': 0 },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// stdinから1行ずつ読み込む
function readStdin() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    let raw = '';
    rl.on('line', (line) => { raw += line; });
    rl.on('close', () => resolve(raw.trim()));
    // タイムアウト保険
    setTimeout(() => { rl.close(); }, 3000);
  });
}

// ファイルパスや簡易説明を取得
function describeInput(toolInput) {
  if (!toolInput) return '';
  return (
    toolInput.file_path ||
    toolInput.path ||
    toolInput.command ||
    toolInput.description ||
    ''
  );
}

async function main() {
  const hookEvent = process.env.HOOK_EVENT || 'PreToolUse';

  // stdinからJSONを読む
  let hookData = null;
  try {
    const raw = await readStdin();
    if (raw) hookData = JSON.parse(raw);
  } catch {
    // JSON parse失敗 → 静かに終了
    process.exit(0);
  }

  if (!hookData) process.exit(0);

  const toolName  = hookData.tool_name  || hookData.tool || '';
  const toolInput = hookData.tool_input || hookData.input || {};
  const desc      = describeInput(toolInput);
  const title     = `🤖 ${toolName}${desc ? ': ' + desc : ''}`;

  if (hookEvent === 'PreToolUse') {
    // タスクを追加
    await httpPost('/api/tasks', {
      title,
      source:        'claude',
      claudeToolName: toolName,
      priority:      'normal',
    });

  } else if (hookEvent === 'PostToolUse') {
    // 直近のClaudeタスク（未完了）を完了にする
    const tasks = await httpGet('/api/tasks?done=false');
    if (!Array.isArray(tasks)) process.exit(0);

    // 同じツール名のうち最新のものを完了
    const target = tasks.find(
      (t) => t.source === 'claude' && t.claudeToolName === toolName
    );
    if (target) {
      await httpPut(`/api/tasks/${target.id}/complete`);
    }
  }

  process.exit(0);
}

// エラーは握りつぶす
main().catch(() => process.exit(0));
