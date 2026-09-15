// AI দিয়ে চেক রেজিস্টার ছবি পড়ার Netlify ফাংশন (Google Gemini)
// Netlify env var লাগবে: GEMINI_API_KEY  (ইচ্ছা হলে GEMINI_MODEL)

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
  }
  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) {
    return { statusCode: 200, body: JSON.stringify({ error: "GEMINI_API_KEY সেট করা হয়নি — Netlify → Site configuration → Environment variables-এ যোগ করুন।" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: "bad request" }) }; }

  const data = String(body.image || "").replace(/^data:[^,]+,/, "");
  const mime = body.mime || "image/jpeg";
  if (!data) return { statusCode: 200, body: JSON.stringify({ error: "কোনো ছবি পাওয়া যায়নি" }) };

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const prompt = [
    "তুমি একজন সহকারী যে বাংলা হাতে লেখা \"চেক রেজিস্টার\" ছবি পড়ে প্রতিটি সারির ডাটা বের করো।",
    "ছবিতে একটি টেবিল আছে। প্রতিটি সারির জন্য নিচের ফিল্ডগুলো বের করে একটি JSON array দাও:",
    '[{ "date":"তারিখ (dd-mm-yy)", "cheque":"চেক নম্বর (শুধু সংখ্যা)", "taka":"টাকা অংকে (যেমন ৩৫,২০০/-)", "words":"টাকা কথায় বাংলায়", "fund":"তহবিল", "payee":"খরচের বিবরণে থাকা ব্যক্তির নাম", "babod":"খরচের বিবরণ সম্পূর্ণ", "khat":"খাত", "demandNo":"স্মারক/ডিমান্ড নং", "demandDate":"স্মারক তারিখ", "page":"পৃষ্ঠা নং" }]',
    "নিয়ম: সব লেখা বাংলায় দাও। সংখ্যা বাংলা অংকে (০-৯)। যা পড়া যায় না সেখানে \"(অস্পষ্ট)\" লেখো। শুধুমাত্র JSON array দাও, অন্য কোনো কথা নয়।"
  ].join("\n");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + KEY;
  const payload = {
    contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: mime, data: data } } ] }],
    generationConfig: { temperature: 0, response_mime_type: "application/json" }
  };

  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!r.ok) {
      const msg = (j && j.error && j.error.message) ? j.error.message : ("HTTP " + r.status);
      return { statusCode: 200, body: JSON.stringify({ error: "Gemini: " + msg }) };
    }
    let text = "";
    try { text = j.candidates[0].content.parts[0].text || ""; } catch (e) {}
    let rows = null;
    try { rows = JSON.parse(text); }
    catch (e) { const m = text.match(/\[[\s\S]*\]/); if (m) { try { rows = JSON.parse(m[0]); } catch (e2) {} } }
    if (rows && !Array.isArray(rows) && Array.isArray(rows.rows)) rows = rows.rows;
    if (!Array.isArray(rows)) {
      return { statusCode: 200, body: JSON.stringify({ error: "AI-র উত্তর পড়া গেল না, আবার চেষ্টা করুন।" }) };
    }
    return { statusCode: 200, body: JSON.stringify({ rows: rows }) };
  } catch (e) {
    return { statusCode: 200, body: JSON.stringify({ error: "সংযোগ সমস্যা: " + String(e) }) };
  }
};
