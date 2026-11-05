// Malayalam-first voice for Ask Local Link, using Google Gemini — the same key and voice
// VoiceBite uses for its Malayalam attendant (GOOGLE_API_KEY or GEMINI_API_KEY, voice "Kore").
//
//   GEMINI_TEXT_MODEL   assistant replies + speech-to-text   default gemini-3.8-flash (falls back automatically)
//   GEMINI_TTS_MODEL    spoken replies                        default gemini-3.8-flash-preview-tts
//   GEMINI_VOICE        default Kore (GEMINI_VOICE_ML / GEMINI_VOICE_EN per language)
import crypto from 'node:crypto';

const BASE = 'https://generativelanguage.googleapis.com/' + (process.env.GEMINI_API_VERSION || 'v1beta') + '/models/';
export const geminiKey = () => process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
// first model that works is remembered; env overrides go first
const TEXT_MODELS = () => ['gemini-3.8-flash', process.env.GEMINI_TEXT_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash'].filter(Boolean);
const TTS_MODELS = () => ['gemini-3.8-flash-preview-tts', process.env.GEMINI_TTS_MODEL, 'gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'].filter(Boolean);
const good = {}; export const lastError = {};
async function callAny(kind, list, body, ms, check) {
  const order = good[kind] ? [good[kind], ...list.filter(m => m !== good[kind])] : list; let err;
  const queue = [...new Set(order)], tried = new Set(); lastError[kind] = null;
  while (queue.length) { const m = queue.shift(); if (tried.has(m)) continue; tried.add(m);
    try { const d = await call(m, body, ms); if (check && !check(d)) throw new Error('Gemini 404 ' + m + ' gave no usable output: ' + JSON.stringify(d).slice(0, 200)); good[kind] = m; lastError[kind] = null; return d; }
    catch (e) { err = e; lastError[kind] = (lastError[kind] ? lastError[kind] + ' || ' : '') + m + ': ' + e.message.slice(0, 160); if (!/ 40[0-9]| 50[0-9]| 429|abort/i.test(e.message)) break;
      const hint = /models\/([\w.\-]+)/.exec(e.message.split(' ').slice(3).join(' ')); if (hint && !tried.has(hint[1])) queue.unshift(hint[1]); } }
  throw err;
}
const voiceFor = (lang) => (lang === 'ml' ? process.env.GEMINI_VOICE_ML : process.env.GEMINI_VOICE_EN) || process.env.GEMINI_VOICE || 'Kore';

async function call(model, body, ms = 25000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(BASE + model + ':generateContent', { method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey() }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('Gemini ' + r.status + ' ' + model + ' ' + (await r.text()).slice(0, 400));
    return await r.json();
  } finally { clearTimeout(t); }
}
const partsOf = (d) => (d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];

// JSON answer from the assistant prompt
export async function geminiJSON(system, user, ms = 9000) {
  const d = await callAny('text', TEXT_MODELS(), { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } } }, ms);
  return JSON.parse(partsOf(d).map(p => p.text || '').join(''));
}

// speech -> text (Malayalam or English), audio sent from the phone as base64
export async function transcribe(b64, mime, lang) {
  const d = await callAny('text', TEXT_MODELS(), { contents: [{ role: 'user', parts: [
    { inlineData: { mimeType: mime || 'audio/webm', data: b64 } },
    { text: `Transcribe this short voice request from a customer in Kerala. It is most likely ${lang === 'en' ? 'English' : 'Malayalam'}, possibly mixed with English words. ` +
            'Write Malayalam in Malayalam script and English words in English. Return ONLY the words spoken, nothing else. If there is no speech, return an empty string.' } ] }],
    generationConfig: { temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } } }, 12000);
  return partsOf(d).map(p => p.text || '').join('').trim().replace(/^["“]|["”]$/g, '');
}

// text -> speech, returned as a WAV (Gemini gives raw 24 kHz 16-bit mono PCM)
const cache = new Map();
function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
export async function speak(text, lang) {
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!text) throw new Error('empty');
  const key = crypto.createHash('sha1').update(lang + '|' + text).digest('hex');
  if (cache.has(key)) return cache.get(key);
  const d = await callAny('tts', TTS_MODELS(), { contents: [{ parts: [{ text }] }],
    generationConfig: { temperature: 0, responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceFor(lang) } } } } }, 30000, d => partsOf(d).some(p => p.inlineData && p.inlineData.data));
  const part = partsOf(d).find(p => p.inlineData && p.inlineData.data);
  if (!part) throw new Error('no audio');
  const m = /rate=(\d+)/.exec(part.inlineData.mimeType || ''); const out = wav(Buffer.from(part.inlineData.data, 'base64'), m ? Number(m[1]) : 24000);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, out); return out;
}

export const voiceModels = () => ({ text: good.text || TEXT_MODELS()[0], tts: good.tts || TTS_MODELS()[0], errors: lastError });
