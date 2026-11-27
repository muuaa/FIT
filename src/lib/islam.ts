/** Islam tracking: surah names (for memorization), the azkar you tick off, and the five prayers. */

/** The 114 surahs: Arabic name, transliteration, number of ayahs. */
export const SURAHS: [ar: string, en: string, ayahs: number][] = [
  ["الفاتحة", "Al-Fatihah", 7],
  ["البقرة", "Al-Baqarah", 286],
  ["آل عمران", "Al-Imran", 200],
  ["النساء", "An-Nisa", 176],
  ["المائدة", "Al-Ma'idah", 120],
  ["الأنعام", "Al-An'am", 165],
  ["الأعراف", "Al-A'raf", 206],
  ["الأنفال", "Al-Anfal", 75],
  ["التوبة", "At-Tawbah", 129],
  ["يونس", "Yunus", 109],
  ["هود", "Hud", 123],
  ["يوسف", "Yusuf", 111],
  ["الرعد", "Ar-Ra'd", 43],
  ["إبراهيم", "Ibrahim", 52],
  ["الحجر", "Al-Hijr", 99],
  ["النحل", "An-Nahl", 128],
  ["الإسراء", "Al-Isra", 111],
  ["الكهف", "Al-Kahf", 110],
  ["مريم", "Maryam", 98],
  ["طه", "Ta-Ha", 135],
  ["الأنبياء", "Al-Anbiya", 112],
  ["الحج", "Al-Hajj", 78],
  ["المؤمنون", "Al-Mu'minun", 118],
  ["النور", "An-Nur", 64],
  ["الفرقان", "Al-Furqan", 77],
  ["الشعراء", "Ash-Shu'ara", 227],
  ["النمل", "An-Naml", 93],
  ["القصص", "Al-Qasas", 88],
  ["العنكبوت", "Al-Ankabut", 69],
  ["الروم", "Ar-Rum", 60],
  ["لقمان", "Luqman", 34],
  ["السجدة", "As-Sajdah", 30],
  ["الأحزاب", "Al-Ahzab", 73],
  ["سبأ", "Saba", 54],
  ["فاطر", "Fatir", 45],
  ["يس", "Ya-Sin", 83],
  ["الصافات", "As-Saffat", 182],
  ["ص", "Sad", 88],
  ["الزمر", "Az-Zumar", 75],
  ["غافر", "Ghafir", 85],
  ["فصلت", "Fussilat", 54],
  ["الشورى", "Ash-Shura", 53],
  ["الزخرف", "Az-Zukhruf", 89],
  ["الدخان", "Ad-Dukhan", 59],
  ["الجاثية", "Al-Jathiyah", 37],
  ["الأحقاف", "Al-Ahqaf", 35],
  ["محمد", "Muhammad", 38],
  ["الفتح", "Al-Fath", 29],
  ["الحجرات", "Al-Hujurat", 18],
  ["ق", "Qaf", 45],
  ["الذاريات", "Adh-Dhariyat", 60],
  ["الطور", "At-Tur", 49],
  ["النجم", "An-Najm", 62],
  ["القمر", "Al-Qamar", 55],
  ["الرحمن", "Ar-Rahman", 78],
  ["الواقعة", "Al-Waqi'ah", 96],
  ["الحديد", "Al-Hadid", 29],
  ["المجادلة", "Al-Mujadilah", 22],
  ["الحشر", "Al-Hashr", 24],
  ["الممتحنة", "Al-Mumtahanah", 13],
  ["الصف", "As-Saff", 14],
  ["الجمعة", "Al-Jumu'ah", 11],
  ["المنافقون", "Al-Munafiqun", 11],
  ["التغابن", "At-Taghabun", 18],
  ["الطلاق", "At-Talaq", 12],
  ["التحريم", "At-Tahrim", 12],
  ["الملك", "Al-Mulk", 30],
  ["القلم", "Al-Qalam", 52],
  ["الحاقة", "Al-Haqqah", 52],
  ["المعارج", "Al-Ma'arij", 44],
  ["نوح", "Nuh", 28],
  ["الجن", "Al-Jinn", 28],
  ["المزمل", "Al-Muzzammil", 20],
  ["المدثر", "Al-Muddaththir", 56],
  ["القيامة", "Al-Qiyamah", 40],
  ["الإنسان", "Al-Insan", 31],
  ["المرسلات", "Al-Mursalat", 50],
  ["النبأ", "An-Naba", 40],
  ["النازعات", "An-Nazi'at", 46],
  ["عبس", "Abasa", 42],
  ["التكوير", "At-Takwir", 29],
  ["الانفطار", "Al-Infitar", 19],
  ["المطففين", "Al-Mutaffifin", 36],
  ["الانشقاق", "Al-Inshiqaq", 25],
  ["البروج", "Al-Buruj", 22],
  ["الطارق", "At-Tariq", 17],
  ["الأعلى", "Al-A'la", 19],
  ["الغاشية", "Al-Ghashiyah", 26],
  ["الفجر", "Al-Fajr", 30],
  ["البلد", "Al-Balad", 20],
  ["الشمس", "Ash-Shams", 15],
  ["الليل", "Al-Layl", 21],
  ["الضحى", "Ad-Duha", 11],
  ["الشرح", "Ash-Sharh", 8],
  ["التين", "At-Tin", 8],
  ["العلق", "Al-Alaq", 19],
  ["القدر", "Al-Qadr", 5],
  ["البينة", "Al-Bayyinah", 8],
  ["الزلزلة", "Az-Zalzalah", 8],
  ["العاديات", "Al-Adiyat", 11],
  ["القارعة", "Al-Qari'ah", 11],
  ["التكاثر", "At-Takathur", 8],
  ["العصر", "Al-Asr", 3],
  ["الهمزة", "Al-Humazah", 9],
  ["الفيل", "Al-Fil", 5],
  ["قريش", "Quraysh", 4],
  ["الماعون", "Al-Ma'un", 7],
  ["الكوثر", "Al-Kawthar", 3],
  ["الكافرون", "Al-Kafirun", 6],
  ["النصر", "An-Nasr", 3],
  ["المسد", "Al-Masad", 5],
  ["الإخلاص", "Al-Ikhlas", 4],
  ["الفلق", "Al-Falaq", 5],
  ["الناس", "An-Nas", 6],
];
export const TOTAL_AYAHS = 6236;
/** Juz' Amma: surahs 78 (An-Naba) to 114 (An-Nas), where most people start memorizing. */
export const JUZ_AMMA_FROM = 78;

export const PRAYERS = [
  { key: 'fajr', label: 'Fajr', ar: 'الفجر', sunnah: '2 before' as string | null },
  { key: 'dhuhr', label: 'Dhuhr', ar: 'الظهر', sunnah: '4 + 2' },
  { key: 'asr', label: 'Asr', ar: 'العصر', sunnah: null },
  { key: 'maghrib', label: 'Maghrib', ar: 'المغرب', sunnah: '2 after' },
  { key: 'isha', label: 'Isha', ar: 'العشاء', sunnah: '2 after' },
] as const;
export type PrayerKey = (typeof PRAYERS)[number]['key'];
/** Prayers with a regular (rawatib) sunnah: all but Asr. */
export const SUNNAH = PRAYERS.filter((p) => p.sunnah);

export type AzkarSet = 'morning' | 'evening' | 'prayer' | 'sleep';

/** Azkar you tick off each day (the text is in your own app). */
export const AZKAR: Record<AzkarSet, { title: string; ar: string; emoji: string }> = {
  morning: { title: 'Morning azkar', ar: 'أذكار الصباح', emoji: '🌅' },
  evening: { title: 'Evening azkar', ar: 'أذكار المساء', emoji: '🌇' },
  prayer: { title: 'After prayer', ar: 'أذكار بعد الصلاة', emoji: '🤲' },
  sleep: { title: 'Before sleep', ar: 'أذكار النوم', emoji: '🌙' },
};
export const AZKAR_SETS: AzkarSet[] = ['morning', 'evening', 'prayer', 'sleep'];

/** Today's date in the Hijri calendar, e.g. "6 Jumada II 1448". */
export function hijri(date: Date = new Date()): string {
  try {
    return date.toLocaleDateString('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ AH$/, '');
  } catch {
    return '';
  }
}

/** Pages in the standard (Madani) mushaf. */
export const MUSHAF_PAGES = 604;
