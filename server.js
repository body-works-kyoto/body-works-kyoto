import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { config } from 'dotenv';
config({ path: '/Users/umetsukatatsushi/diet-app/.env' });
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

app.post('/api/analyze-food', upload.single('image'), async (req, res) => {
  try {
    const { meal } = req.body;
    const imageBase64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `この料理の写真を見て、カロリーを推定してください。
食事タイミング: ${meal}
以下のJSON形式のみで回答してください（他のテキスト不要）:
{"name": "料理名", "calories": 数値, "description": "簡単な説明（20文字以内）", "emoji": "絵文字1文字"}`
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '解析に失敗しました' });
  }
});

app.post('/api/suggest-dinner', async (req, res) => {
  try {
    const { remaining, gender } = req.body;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `${gender === 'female' ? '女性' : '男性'}のダイエット中の人の夕食を提案してください。
残りカロリー: ${remaining} kcal

以下のJSON形式のみで回答してください（他のテキスト不要）:
{"suggestions": [
  {"name": "料理名", "calories": 数値, "emoji": "絵文字", "reason": "一言コメント（15文字以内）"},
  {"name": "料理名", "calories": 数値, "emoji": "絵文字", "reason": "一言コメント（15文字以内）"},
  {"name": "料理名", "calories": 数値, "emoji": "絵文字", "reason": "一言コメント（15文字以内）"}
]}`
      }]
    });

    const text = response.content[0].text.trim();
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '提案の取得に失敗しました' });
  }
});

app.post('/api/read-shakken', upload.single('image'), async (req, res) => {
  try {
    const f = req.file;
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: f.mimetype, data: f.buffer.toString('base64') } },
          { type: 'text', text: `この車検証の画像から情報を読み取り、以下のJSON形式のみで返してください（他のテキスト不要）。読み取れない項目は空文字にしてください。
{"carModel":"車名と型式（例：マツダ CX-3 20S Lパッケージ）","fullModel":"フル型式（例：DKEFW）","chassis":"車台番号","color":"ボデー色（カラーコードと色名）","engine":"エンジン型式","regno":"登録番号（例：京都500あ1234）"}` }
        ]
      }]
    });
    const data = JSON.parse(response.content[0].text.trim());
    res.json(data);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: '読み取りに失敗しました' });
  }
});

app.post('/api/estimate', upload.fields([{ name: 'images', maxCount: 10 }, { name: 'caution' }]), async (req, res) => {
  try {
    const content = [];

    (req.files?.images || []).forEach(f => {
      content.push({ type: 'image', source: { type: 'base64', media_type: f.mimetype, data: f.buffer.toString('base64') } });
    });
    if (req.files?.caution?.[0]) {
      content.push({ type: 'image', source: { type: 'base64', media_type: req.files.caution[0].mimetype, data: req.files.caution[0].buffer.toString('base64') } });
    }

    const memo = req.body.memo || '';
    content.push({
      type: 'text',
      text: `あなたは日本の板金塗装の熟練見積もり職人です。
写真を見て損傷を判定し、以下のJSON形式のみで回答してください（他のテキスト不要）。

単価：板金1指数=9000円、塗装1パネル=50000円

${memo ? `お客様メモ：${memo}` : ''}

{"car": "車種・色（コーションプレートがあれば正確に）",
 "itakin": [{"name": "部位名", "detail": "損傷の説明", "index": 数値}],
 "toso": [{"name": "部位名", "panels": 数値}],
 "parts": [{"name": "部品名", "partPrice": 数値, "labor": 数値}]}`
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content }]
    });

    const data = JSON.parse(response.content[0].text.trim());
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '解析に失敗しました' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
