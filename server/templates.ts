// Ready-made Boxes in Kontho's five-part format, plus the sample answers the
// simulator uses. Organisations start a new Box from one of these.

import type { OrgQuestion, Template, Theme } from '../shared/types.ts';

export interface SimSpec {
  /** Relative share of verified ideas per theme id ('other' = no theme). */
  weights: Record<string, number>;
  /** Example idea answers per theme id. */
  ideas: Record<string, string[]>;
  /** Choice/scale option weights, or a lognormal median for number questions. */
  measured: Record<string, number[] | { median: number; spread: number }>;
}

export interface BoxTemplate extends Template {
  minutes: number;
  pool: number;
  target: number;
  durationHours: number;
  questions: OrgQuestion[];
  themes: Theme[];
  sim: SimSpec;
}

const CHECK: OrgQuestion = {
  id: 'check',
  role: 'check',
  type: 'choice',
  text: 'Quick check that you are reading: choose “Blue”.',
  options: ['Red', 'Blue', 'Green'],
  correct: 1,
};

function fivePart(p: {
  screener: { text: string; options: string[]; disqualify: number[] };
  measured: Omit<OrgQuestion, 'role'>[];
  idea: { text: string; hint?: string };
  themes: Theme[];
}): OrgQuestion[] {
  return [
    { id: 'screener', role: 'screener', type: 'choice', ...p.screener },
    ...p.measured.map((m) => ({ ...m, role: 'measured' as const })),
    { id: 'idea', role: 'idea', type: 'open', text: p.idea.text, hint: p.idea.hint ?? 'Write in Bangla or English. One clear idea is better than a long list.' },
    CHECK,
    {
      id: 'prediction',
      role: 'prediction',
      type: 'choice',
      text: 'What do you think MOST players will say?',
      options: p.themes.slice(0, 5).map((t) => t.label),
    },
  ];
}

const T = (id: string, label: string, keywords: string[]): Theme => ({ id, label, keywords });

const trip: BoxTemplate = {
  key: 'trip',
  title: 'Your daily trip',
  titleBn: 'প্রতিদিনের যাতায়াত',
  topic: 'Transport',
  description: 'Tell us what gets in the way when you travel to work, study or the market.',
  minutes: 6,
  pool: 30000,
  target: 600,
  durationHours: 24,
  themes: [
    T('jam', 'Traffic jams', ['jam', 'traffic', 'congestion', 'stuck', 'যানজট', 'জ্যাম']),
    T('crowd', 'Overcrowded buses', ['crowd', 'packed', 'no space', 'standing', 'ভিড়']),
    T('fare', 'Fares too high', ['fare', 'expensive', 'ভাড়া', 'too much money']),
    T('safe', 'Unsafe for women', ['harass', 'unsafe', 'women', 'theft', 'নিরাপদ', 'মেয়েদের']),
    T('road', 'Broken roads', ['road', 'pothole', 'broken', 'mud', 'রাস্তা']),
    T('wait', 'Long waits, no schedule', ['wait', 'schedule', 'delay', 'অপেক্ষা']),
    T('foot', 'No footpaths', ['footpath', 'pavement', 'ফুটপাত']),
  ],
  questions: [],
  sim: {
    weights: { jam: 30, crowd: 14, fare: 10, safe: 9, road: 8, wait: 6, foot: 5, other: 18 },
    ideas: {
      jam: ['Two hours stuck in traffic at Tongi every morning', 'যানজটে প্রতিদিন দুই ঘণ্টা নষ্ট হয়', 'The traffic jam near the bus stand never ends', 'Stuck in traffic so long I miss my first class', 'জ্যামের কারণে অফিসে দেরি হয়'],
      crowd: ['Buses are so packed people hang off the door', 'No space to stand on the morning bus', 'বাসে প্রচণ্ড ভিড়, দাঁড়ানোর জায়গা নেই', 'The leguna is always overcrowded'],
      fare: ['CNG fare doubled since last year', 'বাস ভাড়া অনেক বেশি নেয়', 'Conductors take extra fare at night', 'Travel fare eats half my salary'],
      safe: ['Harassment on local buses after dark', 'It feels unsafe for women at night', 'রাতে মেয়েদের জন্য নিরাপদ না', 'Phone theft at the bus stop'],
      road: ['Potholes everywhere after the rain', 'The road near my house has been broken for months', 'রাস্তা ভাঙা, কাদা আর পানি'],
      wait: ['Never know when the bus will come, there is no schedule', 'I wait 40 minutes for a bus every day', 'অপেক্ষা করতে করতে দেরি হয়ে যায়'],
      foot: ['No footpath, so we walk next to trucks', 'Shops have taken over the footpath', 'ফুটপাত দখল হয়ে আছে'],
      other: ['Drivers using phones while driving', 'Not enough bus stops near my area', 'Loud horns all day give me headaches'],
    },
    measured: { mode: [38, 16, 18, 10, 4, 14], stress: [5, 10, 22, 33, 30], spend: { median: 80, spread: 0.6 } },
  },
};
trip.questions = fivePart({
  screener: { text: 'Do you travel to work, study or the market at least 3 days a week?', options: ['Yes', 'No'], disqualify: [1] },
  measured: [
    { id: 'mode', type: 'choice', text: 'How do you usually travel?', options: ['Bus', 'CNG or leguna', 'Rickshaw', 'Motorbike or ride-share', 'Train', 'Walk'] },
    { id: 'stress', type: 'scale', text: 'How stressful is your usual trip?', low: 'Not at all', high: 'Very' },
    { id: 'spend', type: 'number', text: 'About how much do you spend on travel on a normal day?', unit: '৳' },
  ],
  idea: { text: 'What is the biggest problem on your daily trip?' },
  themes: trip.themes,
});

const market: BoxTemplate = {
  key: 'market',
  title: 'Everyday market problems',
  titleBn: 'বাজারের সমস্যা',
  topic: 'Daily essentials',
  description: 'What makes buying food and daily essentials hard for your household?',
  minutes: 6,
  pool: 25000,
  target: 800,
  durationHours: 48,
  themes: [
    T('price', 'Prices keep rising', ['price', 'expensive', 'afford', 'দাম']),
    T('fake', 'Adulterated or fake products', ['adulterat', 'fake', 'formalin', 'chemical', 'ভেজাল']),
    T('weight', 'Short weight and scale cheating', ['weight', 'scale', 'cheat', 'ওজন']),
    T('haggle', 'No fixed prices', ['bargain', 'fixed price', 'haggle', 'দরদাম']),
    T('dirty', 'Dirty markets', ['dirty', 'smell', 'garbage', 'নোংরা']),
    T('stock', 'Items out of stock', ['out of stock', 'shortage', 'not available', 'সংকট']),
    T('far', 'No good shop nearby', ['far from', 'nearby', 'distance', 'দূরে']),
  ],
  questions: [],
  sim: {
    weights: { price: 34, fake: 16, weight: 12, haggle: 8, dirty: 8, stock: 6, far: 4, other: 12 },
    ideas: {
      price: ['Rice and oil prices go up every week', 'চাল আর তেলের দাম প্রতি সপ্তাহে বাড়ে', 'We can not afford fish or meat any more', 'Egg prices doubled this year'],
      fake: ['Formalin in fish and fruit', 'Milk and honey are often fake', 'সবকিছুতে ভেজাল', 'Chemical used to ripen mangoes'],
      weight: ['Shopkeepers cheat on the scale', 'ওজনে কম দেয়', 'I bought 1 kg but got 850 grams by weight at home'],
      haggle: ['No fixed price, you have to bargain for everything', 'দরদাম করতে করতে ক্লান্ত', 'Different price for different customers, endless haggle'],
      dirty: ['The bazaar is dirty with garbage everywhere', 'Fish market smell and mud', 'বাজার খুব নোংরা'],
      stock: ['Soybean oil out of stock for days', 'Sugar shortage before Ramadan', 'বাজারে পেঁয়াজের সংকট'],
      far: ['The nearest good shop is far from my village', 'দোকান অনেক দূরে'],
      other: ['Shops close too early', 'No receipts so we cannot complain', 'Too much plastic packaging'],
    },
    measured: { where: [40, 32, 10, 4, 14], budget: [4, 8, 20, 34, 34], weekly: { median: 2500, spread: 0.5 } },
  },
};
market.questions = fivePart({
  screener: { text: 'Do you buy food or daily essentials for your household at least once a week?', options: ['Yes', 'No'], disqualify: [1] },
  measured: [
    { id: 'where', type: 'choice', text: 'Where do you buy most of your groceries?', options: ['Local bazaar', 'Corner shop (mudi dokan)', 'Supermarket', 'Online or an app', 'Weekly haat'] },
    { id: 'budget', type: 'scale', text: 'How hard is it to manage the household food budget this month?', low: 'Easy', high: 'Very hard' },
    { id: 'weekly', type: 'number', text: 'About how much does your household spend on food in a week?', unit: '৳' },
  ],
  idea: { text: 'What is the biggest problem when you shop for daily essentials?' },
  themes: market.themes,
});

const data: BoxTemplate = {
  key: 'data',
  title: 'Mobile data & internet packs',
  titleBn: 'মোবাইল ডাটা',
  topic: 'Telecom & digital',
  description: 'How you use mobile internet, and what frustrates you about data packs.',
  minutes: 5,
  pool: 20000,
  target: 600,
  durationHours: 48,
  themes: [
    T('expiry', 'Packs expire too fast', ['expire', 'validity', 'মেয়াদ']),
    T('price', 'Packs are too expensive', ['expensive', 'price', 'costly', 'দাম']),
    T('speed', 'Slow speed', ['slow', 'speed', 'buffer', 'স্পিড']),
    T('coverage', 'No signal in my area', ['signal', 'coverage', 'network', 'নেটওয়ার্ক']),
    T('offers', 'Confusing offers', ['offer', 'confus', 'hidden', 'অফার']),
    T('deduct', 'Balance cut without reason', ['deduct', 'balance cut', 'কেটে']),
  ],
  questions: [],
  sim: {
    weights: { expiry: 30, price: 22, speed: 18, coverage: 12, offers: 8, deduct: 6, other: 4 },
    ideas: {
      expiry: ['The 7-day pack expires before I use half of it', 'প্যাকের মেয়াদ খুব কম', 'Validity is too short, data is wasted'],
      price: ['Data packs are too expensive for students', 'ডাটার দাম অনেক বেশি', 'The price went up but the GB went down'],
      speed: ['4G sign but the speed is like 2G', 'Videos keep buffering at night', 'স্পিড খুবই কম'],
      coverage: ['No network signal inside my house', 'Coverage disappears in the village', 'গ্রামে নেটওয়ার্ক থাকে না'],
      offers: ['Too many confusing offers, I never know which is best', 'Hidden terms in every offer', 'অফারগুলো বোঝা যায় না'],
      deduct: ['Balance cut for services I never asked for', 'টাকা কেটে নেয় কারণ ছাড়া', 'They deduct money for a song subscription'],
      other: ['Customer care never answers', 'The app is hard to use'],
    },
    measured: { use: [36, 24, 14, 18, 8], satisfied: [18, 26, 30, 18, 8], monthly: { median: 350, spread: 0.55 } },
  },
};
data.questions = fivePart({
  screener: { text: 'Do you use mobile internet on your phone?', options: ['Yes', 'No'], disqualify: [1] },
  measured: [
    { id: 'use', type: 'choice', text: 'What do you use mobile data for most?', options: ['Facebook and social media', 'YouTube and video', 'Work or study', 'WhatsApp or IMO calls', 'Mobile banking'] },
    { id: 'satisfied', type: 'scale', text: 'How satisfied are you with your mobile internet speed?', low: 'Not at all', high: 'Very' },
    { id: 'monthly', type: 'number', text: 'About how much do you spend on data packs in a month?', unit: '৳' },
  ],
  idea: { text: 'What frustrates you most about mobile data packs?' },
  themes: data.themes,
});

const health: BoxTemplate = {
  key: 'health',
  title: 'Health costs',
  titleBn: 'চিকিৎসা খরচ',
  topic: 'Pharma & health',
  description: 'How your family pays for treatment and medicine.',
  minutes: 6,
  pool: 20000,
  target: 500,
  durationHours: 24,
  themes: [
    T('medicine', 'Medicine prices', ['medicine', 'tablet', 'ওষুধ']),
    T('fees', 'Doctor and test fees', ['fees', 'doctor fee', 'tests', 'consultation', 'ফি']),
    T('queue', 'Long hospital queues', ['queue', 'in a line', 'long line', 'serial', 'সিরিয়াল']),
    T('distance', 'Hospital too far', ['far from', 'too far', 'is far', 'distance', 'upazila', 'দূরে']),
    T('trust', 'Hard to trust doctors', ['trust', 'wrong treatment', 'বিশ্বাস']),
    T('fake', 'Fake or expired medicine', ['fake medicine', 'expired medicine', 'expired', 'নকল ওষুধ', 'fake']),
  ],
  questions: [],
  sim: {
    weights: { medicine: 30, fees: 24, queue: 16, distance: 12, trust: 8, fake: 6, other: 4 },
    ideas: {
      medicine: ['Medicine for my mother costs 3,000 taka a month', 'ওষুধের দাম অনেক বেড়েছে', 'Diabetes medicine is too costly'],
      fees: ['Doctors ask for many tests and every test has a fee', 'Consultation fee is 1,000 taka in the city', 'ডাক্তারের ফি অনেক বেশি'],
      queue: ['You stand in a line for hours at the government hospital', 'সিরিয়াল পেতে সারাদিন লাগে', 'The queue starts before sunrise'],
      distance: ['The upazila hospital is far and transport is costly', 'হাসপাতাল অনেক দূরে'],
      trust: ['Hard to trust the village doctor', 'Got the wrong treatment twice', 'ডাক্তারের উপর বিশ্বাস নেই'],
      fake: ['Pharmacies sometimes sell expired medicine', 'নকল ওষুধের ভয় লাগে'],
      other: ['No female doctor nearby', 'Reports take too long'],
    },
    measured: { first: [38, 22, 20, 16, 4], medicine: { median: 900, spread: 0.7 }, worry: [6, 10, 20, 30, 34] },
  },
};
health.questions = fivePart({
  screener: { text: 'Did anyone in your household see a doctor or buy medicine in the last 3 months?', options: ['Yes', 'No'], disqualify: [1] },
  measured: [
    { id: 'first', type: 'choice', text: 'Where does your family usually go first for treatment?', options: ['Pharmacy', 'Government hospital', 'Private clinic', 'Village doctor', 'Online or phone doctor'] },
    { id: 'medicine', type: 'number', text: 'About how much does your household spend on medicine in a month?', unit: '৳' },
    { id: 'worry', type: 'scale', text: 'How worried are you about paying for treatment?', low: 'Not at all', high: 'Very' },
  ],
  idea: { text: 'What makes getting treatment hardest for your family?' },
  themes: health.themes,
});

const gas: BoxTemplate = {
  key: 'gas',
  title: 'Cooking gas',
  titleBn: 'রান্নার গ্যাস',
  topic: 'Household energy',
  description: 'How your family cooks, and what goes wrong with gas.',
  minutes: 5,
  pool: 15000,
  target: 400,
  durationHours: 24,
  themes: [
    T('price', 'Cylinder price too high', ['price', 'expensive', 'too much', 'দাম']),
    T('pressure', 'Low line-gas pressure', ['pressure', 'low gas', 'no gas', 'চাপ']),
    T('supply', 'Cylinders hard to find', ['hard to find', 'shortage', 'not available', 'সংকট']),
    T('safety', 'Fear of leaks and fire', ['leak', 'fire', 'explos', 'explod', 'আগুন']),
    T('weight', 'Under-filled cylinders', ['under-filled', 'weight', 'less gas', 'ওজন']),
  ],
  questions: [],
  sim: {
    weights: { price: 40, pressure: 20, supply: 14, safety: 12, weight: 8, other: 6 },
    ideas: {
      price: ['The 12 kg cylinder price went up again', 'গ্যাসের দাম অনেক বেশি', 'Paying 1,500 taka a month for gas is too much'],
      pressure: ['No gas pressure in the morning, we cook at midnight', 'লাইনে গ্যাসের চাপ থাকে না', 'Low gas from 7 to 11 every day'],
      supply: ['Cylinders are hard to find in our area', 'Dealers say not available, then sell at higher price', 'সিলিন্ডারের সংকট'],
      safety: ['Scared of gas leak and fire at home', 'Cylinder explosions in the news scare me', 'আগুন লাগার ভয়'],
      weight: ['Cylinders feel under-filled', 'We get less gas than we pay for', 'ওজনে কম থাকে'],
      other: ['Stove repair takes days', 'Hard to carry the cylinder upstairs'],
    },
    measured: { lasts: [14, 34, 26, 10, 16], paid: { median: 1450, spread: 0.1 }, safe: [8, 14, 30, 30, 18] },
  },
};
gas.questions = fivePart({
  screener: { text: 'Does your household cook with gas?', options: ['Yes, line gas', 'Yes, a cylinder (LPG)', 'No, wood or other fuel'], disqualify: [2] },
  measured: [
    { id: 'lasts', type: 'choice', text: 'How long does one cylinder last your household?', options: ['Under 3 weeks', '3–5 weeks', '5–8 weeks', 'Over 8 weeks', 'We use line gas'] },
    { id: 'paid', type: 'number', text: 'What did you pay for your last 12 kg cylinder?', unit: '৳' },
    { id: 'safe', type: 'scale', text: 'How safe do you feel with your gas cooker?', low: 'Not safe', high: 'Very safe' },
  ],
  idea: { text: 'What is the biggest problem with cooking gas for your family?' },
  themes: gas.themes,
});

const jobs: BoxTemplate = {
  key: 'jobs',
  title: 'Finding work',
  titleBn: 'কাজের খোঁজ',
  topic: 'Jobs & skills',
  description: 'How people look for work, and what stands in the way.',
  minutes: 6,
  pool: 15000,
  target: 400,
  durationHours: 24,
  themes: [
    T('connections', 'You need connections', ['connection', 'reference', 'lobby', 'মামা']),
    T('pay', 'Pay is too low', ['pay', 'salary', 'wage', 'বেতন']),
    T('jobs', 'Not enough jobs nearby', ['no job', 'not enough', 'few jobs', 'কাজ নেই']),
    T('skills', 'Need skills or training', ['skill', 'training', 'course', 'computer', 'প্রশিক্ষণ']),
    T('bribe', 'Asked for a bribe', ['bribe', 'ঘুষ']),
    T('women', 'Hard for women', ['women', 'female', 'মেয়েদের']),
  ],
  questions: [],
  sim: {
    weights: { connections: 28, pay: 20, jobs: 18, skills: 16, bribe: 8, women: 6, other: 4 },
    ideas: {
      connections: ['Without a reference nobody calls you back', 'মামা-খালু ছাড়া চাকরি হয় না', 'Good jobs go to people with connections'],
      pay: ['The salary in garments is too low to live', 'বেতন খুব কম', 'Pay does not match the hours'],
      jobs: ['There are few jobs in our district', 'গ্রামে কাজ নেই', 'Not enough factory jobs nearby'],
      skills: ['I need computer skills but training is costly', 'প্রশিক্ষণ নেওয়ার সুযোগ নেই', 'Every job asks for English skills'],
      bribe: ['They asked for a bribe for a government job', 'ঘুষ ছাড়া চাকরি পাওয়া যায় না'],
      women: ['Hard for women to find safe work', 'মেয়েদের জন্য কাজের পরিবেশ নেই'],
      other: ['Interviews are always in Dhaka', 'Job posts are fake'],
    },
    measured: { how: [40, 26, 14, 12, 8], hard: [4, 8, 20, 32, 36], months: { median: 5, spread: 0.7 } },
  },
};
jobs.questions = fivePart({
  screener: { text: 'Are you looking for work, or did you change jobs in the last year?', options: ['Yes', 'No'], disqualify: [1] },
  measured: [
    { id: 'how', type: 'choice', text: 'How do you mostly look for work?', options: ['Friends and relatives', 'Facebook groups', 'Job websites', 'Walk in and ask', 'Recruitment agents'] },
    { id: 'hard', type: 'scale', text: 'How hard is it to find decent work near you?', low: 'Easy', high: 'Very hard' },
    { id: 'months', type: 'number', text: 'How many months have you been looking?', unit: 'months' },
  ],
  idea: { text: 'What is the biggest barrier to finding good work?' },
  themes: jobs.themes,
});

const snacks: BoxTemplate = {
  key: 'snacks',
  title: 'Why families switch snack brands',
  titleBn: 'স্ন্যাকস ব্র্যান্ড বদল',
  topic: 'FMCG',
  description: 'What your family buys for snacks, and why you change brands.',
  minutes: 6,
  pool: 20000,
  target: 600,
  durationHours: 24,
  themes: [
    T('price', 'Better price or offer', ['price', 'cheap', 'discount', 'offer', 'দাম']),
    T('taste', 'Taste', ['taste', 'flavour', 'crisp', 'স্বাদ']),
    T('size', 'Smaller packs for the same price', ['smaller', 'size', 'quantity', 'পরিমাণ']),
    T('quality', 'Quality and freshness', ['quality', 'fresh', 'oily', 'মান']),
    T('kids', 'What the children ask for', ['child', 'kids', 'my son', 'daughter', 'বাচ্চা']),
    T('ads', 'Ads and new launches', ['advert', 'commercial', 'new launch', 'influencer']),
  ],
  questions: [],
  sim: {
    weights: { price: 30, taste: 24, size: 16, quality: 14, kids: 10, ads: 6, other: 0 },
    ideas: {
      price: ['Whichever brand has a discount that week', 'দাম কম হলে সেটাই কিনি', 'Buy one get one offer'],
      taste: ['The taste changed so we switched', 'স্বাদ ভালো লাগলে কিনি', 'New flavour tastes better'],
      size: ['Packs got smaller but the price stayed the same', 'পরিমাণ কমে গেছে'],
      quality: ['Chips were oily and not fresh', 'মান খারাপ হয়ে গেছে'],
      kids: ['My son only wants the one with the toy', 'বাচ্চারা যেটা চায়'],
      ads: ['Saw a new launch advert on Facebook', 'An influencer recommended it'],
      other: ['The shop near us stopped keeping it'],
    },
    measured: { kind: [30, 34, 18, 10, 8], spent: { median: 220, spread: 0.5 }, trust: [12, 20, 34, 24, 10] },
  },
};
snacks.questions = fivePart({
  screener: { text: 'Have you bought packaged snacks for your household in the last 7 days?', options: ['Yes', 'No'], disqualify: [1] },
  measured: [
    { id: 'kind', type: 'choice', text: 'Which kind of snack did you buy most recently?', options: ['Chips and crisps', 'Biscuits', 'Chanachur', 'Cakes', 'Noodles'] },
    { id: 'spent', type: 'number', text: 'How much did you spend on snacks last week?', unit: '৳' },
    { id: 'trust', type: 'scale', text: 'How much do you trust the price on the pack?', low: 'Not at all', high: 'Fully' },
  ],
  idea: { text: 'What makes you switch from one snack brand to another?' },
  themes: snacks.themes,
});

export const TEMPLATES: BoxTemplate[] = [market, data, trip, health, gas, jobs, snacks];
export const getTemplate = (key: string) => TEMPLATES.find((t) => t.key === key);

/** Templates the demo slot releases to players, in turn. */
export const RELEASE_ORDER = ['health', 'gas', 'jobs', 'trip'];

/**
 * Put an idea answer in a theme by keyword. When several themes match, the
 * longest (most specific) keyword wins, so "fake medicine" beats "medicine".
 * The production app groups by meaning with AI; this keeps the build self-contained.
 */
export function classify(text: string, themes: Theme[]): string | null {
  const t = text.toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const theme of themes) {
    for (const k of theme.keywords) {
      const key = k.toLowerCase().trim();
      if (key && t.includes(key) && (!best || key.length > best.len)) best = { id: theme.id, len: key.length };
    }
  }
  return best?.id ?? null;
}
