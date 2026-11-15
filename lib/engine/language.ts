// Local language detection: english / hindi / hinglish / mixed.
// Two signals: share of Devanagari letters, and share of Latin-script words
// that are common romanised Hindi words.
import type { Language } from "@/lib/db/schema";

// ~170 common romanised Hindi words. Words that are also common English words
// ("is", "to", "me", "main", "do", "hi") are left out on purpose.
const ROMAN_HINDI = new Set(
  `hai hain tha thi ka ki ke ko se mein aur ya lekin sirf bas bahut bohot accha acha achha theek thik sab sabse
  kuch koi yeh ye woh wo yahan wahan kab kaise kitna kitne abhi kal aaj din raat subah shaam ghar dost yaar bhai
  chalo aao jao liye saath wala wali wale naya nayi naye purana pyaar dil zindagi khushi khushiyan mazaa maza swad swaad
  garam thanda meetha pani doodh apna apni apne hamara hamari humara humari tumhara aapka aapki aapke mera meri mere
  tera uska inka unka kyunki isliye phir fir toh bhi na mat jab tab tak pe andar bahar upar neeche pehle baad
  jaldi der hoga hogi honge raha rahi rahe gaya gayi gaye kiya kiye karna karne karte karta karti karein karo kar
  kijiye dekho dekhiye suno bolo piyo pio khao banao manao milega milegi milta milti chahiye hota hoti hote wahi yahi
  itna utna zyada kam thoda pura poora har ek teen char paanch saal mahina hafta hafte tyohar tyohaar khaas shubh
  mubarak badhai parivar rishte mehmaan sasta mehenga daam muft turant kya kyun kyu nahi nahin hum tum aap ab
  ghante lijiye aaiye kahin kabhi hamesha roz rozana sath wahin`.split(/\s+/),
);

const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN_WORD = /[A-Za-z][A-Za-z']*/g;

export type LanguageStats = { language: Language; devanagariShare: number; romanHindiShare: number };

export function languageStats(text: string): LanguageStats {
  const devanagari = (text.match(DEVANAGARI) ?? []).length;
  const latinWords = text.match(LATIN_WORD) ?? [];
  const latinLetters = latinWords.join("").length;
  const letters = devanagari + latinLetters;
  const devanagariShare = letters === 0 ? 0 : devanagari / letters;

  const hindiHits = latinWords.filter((w) => ROMAN_HINDI.has(w.toLowerCase())).length;
  const romanHindiShare = latinWords.length === 0 ? 0 : hindiHits / latinWords.length;

  let language: Language = "english";
  if (devanagariShare >= 0.7) language = "hindi";
  else if (devanagariShare >= 0.15) language = "mixed";
  else if (hindiHits >= 2 && romanHindiShare >= 0.12) language = "hinglish";

  return { language, devanagariShare, romanHindiShare };
}

export function detectLanguage(text: string): Language {
  return languageStats(text).language;
}

/** Position of the first Hindi (Devanagari or romanised) word, used to anchor the language-rule flag. */
export function firstHindiWord(text: string): { start: number; end: number } | null {
  const re = /[ऀ-ॿ]+|[A-Za-z][A-Za-z']*/g;
  for (const m of text.matchAll(re)) {
    const word = m[0];
    if (/[ऀ-ॿ]/.test(word) || ROMAN_HINDI.has(word.toLowerCase())) {
      return { start: m.index, end: m.index + word.length };
    }
  }
  return null;
}
