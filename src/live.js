// Real-time voice for Ask Local Link — Gemini Live, the same engine VoiceBite uses for Malayalam.
// The phone streams the microphone straight to Gemini and hears the reply as it is spoken, so there is
// no record → transcribe → answer → speak chain. The API key stays here: the phone gets a one-use token.
//
//   GEMINI_LIVE_MODEL   default gemini-3.8-live (VoiceBite's default)
//   GEMINI_VOICE        default Kore (GEMINI_VOICE_ML / GEMINI_VOICE_EN per language)
import { geminiKey } from './voice.js';

export const liveModel = () => process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
const voiceFor = (lang) => (lang === 'ml' ? process.env.GEMINI_VOICE_ML : process.env.GEMINI_VOICE_EN) || process.env.GEMINI_VOICE || 'Kore';

export function livePrompt(lang, name) {
  const ML = lang === 'ml';
  return `You are "Ask Local Link", the friendly voice assistant of Local Link, a local marketplace for Kunnamangalam and nearby areas of Kozhikode, Kerala. ` +
    `You help people find shops, restaurants and food, groceries, home services (electrician, plumber and so on), local workers and autos or taxis, and you can track their orders and show offers. ` +
    (ML
      ? `Always speak natural, everyday spoken Malayalam, like a warm Kozhikode shop assistant — simple and polite, never textbook Malayalam. Keep shop names, dish names and common English words (biriyani, AC, auto, plumber, offer) as people in Kerala say them. Switch to English only if the user clearly speaks English. `
      : `Always speak clear, friendly Indian English. Switch to Malayalam only if the user clearly speaks Malayalam. `) +
    `The user has ALREADY been greeted by the app, so do not greet or introduce yourself again — answer straight away. ` +
    `For anything about shops, food, products, prices, services, workers or rides, ALWAYS call search_local first and answer ONLY from what it returns; never invent shops, prices or timings. ` +
    `For "my order" or tracking questions call track_orders. For deals call show_offers. ` +
    `Keep every reply short and spoken: one or two sentences, at most about 30 words. Name the best match with one useful detail (price, rating or area), then offer a next step such as adding to cart or booking. No lists, no emoji, no URLs. ` +
    `The results appear on the user's screen as cards, so you do not need to read every option. If nothing matches, say so honestly and suggest something close. ` +
    (name ? `The user's name is ${name}. ` : '');
}

export const liveTools = [{ functionDeclarations: [
  { name: 'search_local', description: 'Search the Local Link catalogue of nearby shops, restaurants, products, services, workers and rides. Use for every shopping or service request.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'What the user wants, in English keywords, e.g. "biriyani", "electrician", "vegetables and milk", "auto to airport"' } }, required: ['query'] } },
  { name: 'track_orders', description: "Get the user's current orders and their status.", parameters: { type: 'OBJECT', properties: {} } },
  { name: 'show_offers', description: 'Get current offers and deals from nearby shops.', parameters: { type: 'OBJECT', properties: {} } },
] }];

// one-use token for the phone's direct Live connection (v1alpha auth_tokens)
export async function liveToken() {
  const now = Date.now();
  const r = await fetch('https://generativelanguage.googleapis.com/v1alpha/auth_tokens', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey() },
    body: JSON.stringify({ uses: 1, expireTime: new Date(now + 30 * 60e3).toISOString(), newSessionExpireTime: new Date(now + 2 * 60e3).toISOString() }),
  });
  if (!r.ok) throw new Error('Live token ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const d = await r.json();
  if (!d.name) throw new Error('Live token: no name in reply');
  return d.name;
}

export async function liveSession(lang, name) {
  lang = lang === 'en' ? 'en' : 'ml';
  return {
    token: await liveToken(),
    url: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
    setup: {
      model: 'models/' + liveModel(),
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceFor(lang) } } } },
      systemInstruction: { parts: [{ text: livePrompt(lang, name) }] },
      tools: liveTools,
      inputAudioTranscription: {}, outputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: { silenceDurationMs: 700 } },
    },
  };
}
