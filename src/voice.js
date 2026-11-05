// Malayalam-first voice for Ask Local Link, using Google Gemini — the same key and voice
// VoiceBite uses for its Malayalam attendant (GOOGLE_API_KEY or GEMINI_API_KEY, voice "Kore").
//
//   GEMINI_TEXT_MODEL   assistant replies + speech-to-text   default gemini-2.5-flash
//   GEMINI_TTS_MODEL    spoken replies                        default gemini-2.5-flash-preview-tts
//   GEMINI_VOICE        default Kore (GEMINI_VOICE_ML / GEMINI_VOICE_EN per language)
import crypto from 'node:crypto';

const BASE = 'https://generativelanguage.googleapis.com/' + (process.env.GEMINI_API_VERSION || 'v1beta') + '/models/';
export const geminiKey = () => process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const TEXT_MODEL = () => process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const TTS_MODEL = () => process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const voiceFor = (lang) => (lang === 'ml' ? process.env.GEMINI_VOICE_ML : process.env.GEMINI_VOICE_EN) || process.env.GEMINI_VOICE || 'Kore';

async function call(model, body, ms = 25000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(BASE + model + ':generateContent', { method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey() }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('Gemini ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return await r.json();
  } finally { clearTimeout(t); }
}
const partsOf = (d) => (d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];

// JSON answer from the assistant prompt
export async function geminiJSON(system, user) {
  const d = await call(TEXT_MODEL(), { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0.3, responseMimeType: 'application/json' } });
  return JSON.parse(partsOf(d).map(p => p.text || '').join(''));
}

// speech -> text (Malayalam or English), audio sent from the phone as base64
export async function transcribe(b64, mime, lang) {
  const d = await call(TEXT_MODEL(), { contents: [{ role: 'user', parts: [
    { inlineData: { mimeType: mime || 'audio/webm', data: b64 } },
    { text: `Transcribe this short voice request from a customer in Kerala. It is most likely ${lang === 'en' ? 'English' : 'Malayalam'}, possibly mixed with English words. ` +
            'Write Malayalam in Malayalam script and English words in English. Return ONLY the words spoken, nothing else. If there is no speech, return an empty string.' } ] }],
    generationConfig: { temperature: 0 } });
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
  const style = lang === 'ml' ? 'Say this warmly in natural, everyday spoken Malayalam, like a friendly Kerala shop assistant:' : 'Say this warmly and clearly, with a light Indian English accent:';
  const d = await call(TTS_MODEL(), { contents: [{ parts: [{ text: `${style} ${text}` }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceFor(lang) } } } } }, 30000);
  const part = partsOf(d).find(p => p.inlineData && p.inlineData.data);
  if (!part) throw new Error('no audio');
  const m = /rate=(\d+)/.exec(part.inlineData.mimeType || ''); const out = wav(Buffer.from(part.inlineData.data, 'base64'), m ? Number(m[1]) : 24000);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, out); return out;
}
