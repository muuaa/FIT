/** Islam: the Quran's surahs (Hafs), daily azkar (Hisn al-Muslim) and the five prayers. */

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
  { key: 'fajr', label: 'Fajr', ar: 'الفجر' },
  { key: 'dhuhr', label: 'Dhuhr', ar: 'الظهر' },
  { key: 'asr', label: 'Asr', ar: 'العصر' },
  { key: 'maghrib', label: 'Maghrib', ar: 'المغرب' },
  { key: 'isha', label: 'Isha', ar: 'العشاء' },
] as const;
export type PrayerKey = (typeof PRAYERS)[number]['key'];

export interface Zikr {
  id: string;
  text: string;
  count: number;
  /** Short note on what it is. */
  note?: string;
}
export type AzkarSet = 'morning' | 'evening' | 'prayer' | 'sleep';

const KURSI =
  'الله لا إله إلا هو الحي القيوم، لا تأخذه سنة ولا نوم، له ما في السماوات وما في الأرض، من ذا الذي يشفع عنده إلا بإذنه، يعلم ما بين أيديهم وما خلفهم، ولا يحيطون بشيء من علمه إلا بما شاء، وسع كرسيه السماوات والأرض، ولا يؤوده حفظهما، وهو العلي العظيم';
const IKHLAS = 'بسم الله الرحمن الرحيم. قل هو الله أحد ۝ الله الصمد ۝ لم يلد ولم يولد ۝ ولم يكن له كفوا أحد';
const FALAQ = 'بسم الله الرحمن الرحيم. قل أعوذ برب الفلق ۝ من شر ما خلق ۝ ومن شر غاسق إذا وقب ۝ ومن شر النفاثات في العقد ۝ ومن شر حاسد إذا حسد';
const NAS = 'بسم الله الرحمن الرحيم. قل أعوذ برب الناس ۝ ملك الناس ۝ إله الناس ۝ من شر الوسواس الخناس ۝ الذي يوسوس في صدور الناس ۝ من الجنة والناس';
const ISTIGHFAR_SAYYID =
  'اللهم أنت ربي لا إله إلا أنت، خلقتني وأنا عبدك، وأنا على عهدك ووعدك ما استطعت، أعوذ بك من شر ما صنعت، أبوء لك بنعمتك علي، وأبوء بذنبي فاغفر لي، فإنه لا يغفر الذنوب إلا أنت';
const TAHLIL = 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير';

const shared = (): Zikr[] => [
  { id: 'kursi', text: KURSI, count: 1, note: 'Ayat al-Kursi' },
  { id: 'ikhlas', text: IKHLAS, count: 3, note: 'Al-Ikhlas' },
  { id: 'falaq', text: FALAQ, count: 3, note: 'Al-Falaq' },
  { id: 'nas', text: NAS, count: 3, note: 'An-Nas' },
];

export const AZKAR: Record<AzkarSet, { title: string; ar: string; emoji: string; items: Zikr[] }> = {
  morning: {
    title: 'Morning azkar',
    ar: 'أذكار الصباح',
    emoji: '🌅',
    items: [
      ...shared(),
      {
        id: 'asbahna',
        text: 'أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، رب أسألك خير ما في هذا اليوم وخير ما بعده، وأعوذ بك من شر ما في هذا اليوم وشر ما بعده، رب أعوذ بك من الكسل وسوء الكبر، رب أعوذ بك من عذاب في النار وعذاب في القبر',
        count: 1,
      },
      { id: 'bika', text: 'اللهم بك أصبحنا، وبك أمسينا، وبك نحيا، وبك نموت، وإليك النشور', count: 1 },
      { id: 'sayyid', text: ISTIGHFAR_SAYYID, count: 1, note: 'Sayyid al-Istighfar' },
      { id: 'hasbi', text: 'حسبي الله لا إله إلا هو، عليه توكلت، وهو رب العرش العظيم', count: 7 },
      { id: 'bismillah', text: 'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء، وهو السميع العليم', count: 3 },
      { id: 'radeet', text: 'رضيت بالله ربا، وبالإسلام دينا، وبمحمد صلى الله عليه وسلم نبيا', count: 3 },
      { id: 'afini', text: 'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت', count: 3 },
      { id: 'hayy', text: 'يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله، ولا تكلني إلى نفسي طرفة عين', count: 1 },
      { id: 'tahlil', text: TAHLIL, count: 10 },
      { id: 'subhan', text: 'سبحان الله وبحمده', count: 100 },
      { id: 'istighfar', text: 'أستغفر الله وأتوب إليه', count: 100 },
    ],
  },
  evening: {
    title: 'Evening azkar',
    ar: 'أذكار المساء',
    emoji: '🌇',
    items: [
      ...shared(),
      {
        id: 'amsayna',
        text: 'أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير، رب أسألك خير ما في هذه الليلة وخير ما بعدها، وأعوذ بك من شر ما في هذه الليلة وشر ما بعدها، رب أعوذ بك من الكسل وسوء الكبر، رب أعوذ بك من عذاب في النار وعذاب في القبر',
        count: 1,
      },
      { id: 'bika', text: 'اللهم بك أمسينا، وبك أصبحنا، وبك نحيا، وبك نموت، وإليك المصير', count: 1 },
      { id: 'sayyid', text: ISTIGHFAR_SAYYID, count: 1, note: 'Sayyid al-Istighfar' },
      { id: 'hasbi', text: 'حسبي الله لا إله إلا هو، عليه توكلت، وهو رب العرش العظيم', count: 7 },
      { id: 'bismillah', text: 'بسم الله الذي لا يضر مع اسمه شيء في الأرض ولا في السماء، وهو السميع العليم', count: 3 },
      { id: 'kalimat', text: 'أعوذ بكلمات الله التامات من شر ما خلق', count: 3 },
      { id: 'radeet', text: 'رضيت بالله ربا، وبالإسلام دينا، وبمحمد صلى الله عليه وسلم نبيا', count: 3 },
      { id: 'afini', text: 'اللهم عافني في بدني، اللهم عافني في سمعي، اللهم عافني في بصري، لا إله إلا أنت', count: 3 },
      { id: 'hayy', text: 'يا حي يا قيوم برحمتك أستغيث، أصلح لي شأني كله، ولا تكلني إلى نفسي طرفة عين', count: 1 },
      { id: 'tahlil', text: TAHLIL, count: 10 },
      { id: 'subhan', text: 'سبحان الله وبحمده', count: 100 },
    ],
  },
  prayer: {
    title: 'After prayer',
    ar: 'أذكار بعد الصلاة',
    emoji: '🤲',
    items: [
      { id: 'astaghfir', text: 'أستغفر الله', count: 3 },
      { id: 'salam', text: 'اللهم أنت السلام ومنك السلام، تباركت يا ذا الجلال والإكرام', count: 1 },
      { id: 'subhanallah', text: 'سبحان الله', count: 33 },
      { id: 'alhamdulillah', text: 'الحمد لله', count: 33 },
      { id: 'allahuakbar', text: 'الله أكبر', count: 33 },
      { id: 'tahlil', text: TAHLIL, count: 1 },
      { id: 'kursi', text: KURSI, count: 1, note: 'Ayat al-Kursi' },
    ],
  },
  sleep: {
    title: 'Before sleep',
    ar: 'أذكار النوم',
    emoji: '🌙',
    items: [
      { id: 'bismika', text: 'باسمك اللهم أموت وأحيا', count: 1 },
      { id: 'kursi', text: KURSI, count: 1, note: 'Ayat al-Kursi' },
      { id: 'ikhlas', text: IKHLAS, count: 3, note: 'Al-Ikhlas' },
      { id: 'falaq', text: FALAQ, count: 3, note: 'Al-Falaq' },
      { id: 'nas', text: NAS, count: 3, note: 'An-Nas' },
      { id: 'subhanallah', text: 'سبحان الله', count: 33 },
      { id: 'alhamdulillah', text: 'الحمد لله', count: 33 },
      { id: 'allahuakbar', text: 'الله أكبر', count: 34 },
    ],
  },
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
