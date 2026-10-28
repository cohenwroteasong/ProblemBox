// Sample boxes and realistic problem templates. Used to seed the demo account,
// to fill a new account on request ("Load sample data"), and by the live demo
// feed that simulates incoming submissions.

import type { Category, Priority, Status } from '../shared/types.ts';
import { db, insertProblem, slugify, tx } from './db.ts';
import { triage } from './triage.ts';

type BoxKey = 'facilities' | 'it' | 'hostel' | 'library' | 'cafeteria' | 'transport';

export const SAMPLE_BOXES: { key: BoxKey; name: string; description: string; color: string; weight: number }[] = [
  { key: 'facilities', name: 'Campus Facilities', description: 'Classrooms, washrooms, lifts, lighting and anything broken around campus.', color: '#2a78d6', weight: 22 },
  { key: 'it', name: 'IT & Wi-Fi', description: 'Network, computer labs, student portal and software.', color: '#6250d6', weight: 18 },
  { key: 'hostel', name: 'Hostels', description: 'Rooms, water, power and safety in the residence halls.', color: '#eb6834', weight: 20 },
  { key: 'library', name: 'Library', description: 'Seats, books, noise and opening hours.', color: '#1baf7a', weight: 12 },
  { key: 'cafeteria', name: 'Cafeteria', description: 'Food quality, hygiene, prices and queues.', color: '#eda100', weight: 14 },
  { key: 'transport', name: 'Transport', description: 'Campus buses, routes, timings and parking.', color: '#e87ba4', weight: 14 },
];

interface Template {
  title: string;
  body: string;
  category: Category;
  priority: Priority;
}

const T = (title: string, body: string, category: Category, priority: Priority): Template => ({ title, body, category, priority });

const TEMPLATES: Record<BoxKey, Template[]> = {
  facilities: [
    T('Ceiling fan not working in Room {room}', 'The fan in Room {room} has been dead since Monday. It gets really hot during afternoon classes and people are leaving early.', 'Facilities', 'normal'),
    T('Projector flickering in Lecture Hall {block}', 'The projector keeps cutting out every few minutes, so lecturers have to restart it in the middle of class.', 'Facilities', 'normal'),
    T('No water in the {floor} floor washroom, Block {block}', 'Taps have been dry since this morning and there is no soap either.', 'Facilities', 'high'),
    T('Broken chairs in Room {room}', 'At least six chairs are broken and students are standing at the back during lectures.', 'Facilities', 'low'),
    T('Ceiling leaking near the {floor} floor stairs', 'Every time it rains water drips onto the stairs. Someone almost slipped today.', 'Safety', 'high'),
    T('AC in Seminar Room {room} is extremely loud', 'It rattles so loudly that people at the back cannot hear the speaker.', 'Facilities', 'low'),
    T('Lift in Block {block} stuck between floors again', 'It stopped between the 2nd and 3rd floor with four people inside for ten minutes. Second time this week.', 'Safety', 'urgent'),
    T('Exposed wires next to the notice board in Block {block}', 'There is a loose cable hanging out of the wall at hand height, right where people stand to read notices.', 'Safety', 'urgent'),
    T('Drinking water filter on the {floor} floor is empty', 'The filter has been empty for two days. We have to go to another building for water.', 'Facilities', 'normal'),
    T('Lights out in the parking lot behind Block {block}', 'It is pitch dark after 7pm and does not feel safe walking to the bus.', 'Safety', 'high'),
    T('Classroom {room} whiteboard markers never available', 'Teachers keep sending students to find markers, we lose ten minutes every class.', 'Services', 'low'),
  ],
  it: [
    T('Wi-Fi keeps dropping in the {floor} floor reading area', 'Connection drops every 5–10 minutes, especially in the afternoon. Hard to attend online sessions.', 'IT & Network', 'high'),
    T('Cannot log in to the student portal', 'It says my password is wrong even after resetting it twice. I need to register for courses this week.', 'IT & Network', 'normal'),
    T('Lab {lab} computers are missing MATLAB', 'We have a practical tomorrow and half the machines do not have it installed.', 'IT & Network', 'high'),
    T('Printer in Lab {lab} jams on every job', 'Every print job jams after the first page. Nobody seems to be in charge of fixing it.', 'IT & Network', 'low'),
    T('Exam results page timing out', 'The results page has been loading forever since 10am. Lots of students are panicking.', 'IT & Network', 'high'),
    T('Campus Wi-Fi very slow after {time}', 'Speeds drop below 1 Mbps every evening, impossible to submit assignments from the hostel.', 'IT & Network', 'normal'),
    T('University email not syncing on phones', 'Email works on the website but the phone app stopped syncing after the update.', 'IT & Network', 'low'),
    T('Lab {lab} keyboards missing keys', 'Several keyboards are missing keys or have sticky spacebars.', 'IT & Network', 'low'),
    T('Online class recordings not uploaded for two weeks', 'Recordings for our Tuesday and Thursday classes have not been uploaded since the 2nd week.', 'Services', 'normal'),
  ],
  hostel: [
    T('No hot water in {hall} Hall since yesterday', 'The geysers on our floor stopped working and it is getting cold in the mornings.', 'Facilities', 'high'),
    T('Power cuts every night in {hall} Hall', 'Electricity goes off around {time} almost every night and the generator does not start.', 'Facilities', 'high'),
    T('Smell of gas near the {hall} Hall kitchen', 'There is a strong gas smell near the common kitchen stove. Please check it urgently.', 'Safety', 'urgent'),
    T('Mosquitoes everywhere on the {floor} floor', 'The drains outside are clogged and we have been bitten all night. Worried about dengue.', 'Facilities', 'normal'),
    T('Room {room} door lock is broken', 'The lock does not close at all, so I cannot leave my things in the room.', 'Safety', 'high'),
    T('Loud music after midnight in {hall} Hall', 'Same rooms every night, it is impossible to sleep before exams.', 'Policy', 'low'),
    T('Washing machines out of order in {hall} Hall', 'Three of the four machines have been broken for a week and there is a long queue.', 'Facilities', 'normal'),
    T('Visitor curfew rules are unclear', 'Guards are applying different rules on different nights. Can the rules be posted somewhere?', 'Policy', 'low'),
    T('Water from the tank looks brown', 'Tap water in {hall} Hall has been brownish for three days. Has the tank been cleaned?', 'Facilities', 'high'),
    T('Man loitering near the {hall} Hall gate at night', 'Someone has been hanging around the gate after 10pm and following students. Please increase security.', 'Safety', 'urgent'),
  ],
  library: [
    T('Not enough seats during exam week', 'People are sitting on the floor and on the stairs. Could the seminar rooms open as study space?', 'Services', 'normal'),
    T('Library closes too early before finals', 'Can the library stay open until 11pm during exam weeks? Hostels are too noisy to study.', 'Policy', 'normal'),
    T('Only one copy of the core textbook', 'There is only one copy of the Data Structures textbook for almost 200 students.', 'Services', 'normal'),
    T('Study room booking double-books rooms', 'We booked Room 2 and another group had the same slot. Happened twice now.', 'IT & Network', 'low'),
    T('Renovation noise on the {floor} floor', 'Drilling all afternoon right next to the quiet section.', 'Facilities', 'normal'),
    T('Plug points not working at the window desks', 'Most of the sockets at the long window desks are dead.', 'Facilities', 'low'),
    T('Late fee charged for a book I returned', 'I returned it on time and have the slip but the system still shows it as overdue.', 'Services', 'low'),
    T('AC not working in the main reading hall', 'It is very hot and humid inside, people are leaving after an hour.', 'Facilities', 'high'),
  ],
  cafeteria: [
    T('Found a hair in today’s lunch', 'Found a hair in the rice at the 1pm service. Kitchen staff were not wearing caps.', 'Food', 'high'),
    T('Prices went up again without notice', 'Lunch went from 60 to 75 taka overnight. Can price changes be announced in advance?', 'Policy', 'normal'),
    T('Lunch queue takes 30+ minutes', 'Only one counter is open at peak time, and we have 20 minutes between classes.', 'Services', 'normal'),
    T('No vegetarian option most days', 'Almost every main dish has meat or fish.', 'Food', 'low'),
    T('Drinking water dispenser smells bad', 'The water at the dispenser near the entrance smells odd. Please check the filter.', 'Food', 'high'),
    T('Chicken was undercooked', 'The chicken curry today was pink inside. A few of us felt sick afterwards.', 'Food', 'high'),
    T('Tables and trays are not being cleaned', 'Tables are sticky and trays are stacked dirty by noon.', 'Food', 'normal'),
    T('Please add card or bKash payments', 'Cash only makes the queue much slower. Most of us pay with bKash anyway.', 'Services', 'low'),
  ],
  transport: [
    T('Bus {bus} is consistently 20 minutes late', 'Every morning this week Bus {bus} came 20+ minutes late and we missed the first class.', 'Transport', 'normal'),
    T('Bus {bus} overcrowded in the morning', 'People are standing on the steps with the door open. Could another bus be added on this route?', 'Transport', 'normal'),
    T('Bus {bus} driver driving recklessly', 'He was speeding and overtaking on the highway with students standing inside. It felt unsafe.', 'Safety', 'urgent'),
    T('Need an extra evening bus after {time}', 'Evening lab students have no way home after the last bus.', 'Transport', 'low'),
    T('Bus schedule on the website is outdated', 'The timetable online still shows last semester’s routes.', 'Services', 'low'),
    T('No shade at the main bus stop', 'People wait 20 minutes in direct sun. A student fainted there yesterday.', 'Facilities', 'high'),
    T('Bike parking is full by 9am', 'There is no space after 9, so bikes end up blocking the walkway.', 'Transport', 'low'),
    T('AC broken on Bus {bus}', 'The AC has not worked for two weeks and the windows do not open.', 'Transport', 'normal'),
  ],
};

const HALLS = ['Shapla', 'Padma', 'Jamuna', 'Meghna', 'Karnaphuli'];
const FLOORS = ['1st', '2nd', '3rd', '4th', '5th'];
const NAMES = ['Nusrat', 'Tanvir', 'Farhan', 'Sadia', 'Rafi', 'Mehjabin', 'Arif', 'Tasnim', 'Imran', 'Lamia', 'Shuvo', 'Anika'];
const NOTES = [
  'Forwarded to the maintenance team.',
  'Technician scheduled for tomorrow morning.',
  'Spoke with the vendor, replacement part ordered.',
  'Checked on site and confirmed the issue.',
  'Shared with the hall provost.',
  'Raised with the transport office.',
  'Asked the reporter for a photo if possible.',
];

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function pickWeighted<T extends { weight: number }>(list: T[]): T {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of list) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return list[list.length - 1];
}

function fill(text: string): string {
  return text
    .replaceAll('{room}', String(pick([101, 104, 108, 203, 207, 214, 302, 305, 311, 402, 410, 506])))
    .replaceAll('{floor}', pick(FLOORS))
    .replaceAll('{block}', pick(['A', 'B', 'C', 'D', 'E']))
    .replaceAll('{hall}', pick(HALLS))
    .replaceAll('{bus}', String(Math.ceil(Math.random() * 12)))
    .replaceAll('{lab}', String(Math.ceil(Math.random() * 6)))
    .replaceAll('{time}', pick(['8pm', '9pm', '10pm']));
}

function drawTemplate(key: BoxKey) {
  const t = pick(TEMPLATES[key]);
  // Fill the title and body with the same placeholder values.
  const filled = fill(`${t.title}\u0000${t.body}`).split('\u0000');
  return { ...t, title: filled[0], body: filled[1] };
}

/** Lognormal sample with the given median (hours) and spread. */
function lognormal(median: number, sigma: number) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return median * Math.exp(sigma * z);
}

// Hour-of-day weights: busy mid-morning to early afternoon, a smaller evening bump.
const HOUR_WEIGHTS = [0.2, 0.1, 0.1, 0.05, 0.05, 0.1, 0.3, 0.8, 1.6, 2.4, 2.8, 2.6, 2.4, 2.2, 2.0, 1.7, 1.4, 1.1, 1.0, 1.2, 1.4, 1.3, 0.9, 0.5];
const HOUR_ITEMS = HOUR_WEIGHTS.map((weight, hour) => ({ hour, weight }));

function boxKeyFor(name: string): BoxKey | null {
  const n = name.toLowerCase();
  if (/wi-?fi|\bit\b|network|tech|computer|portal/.test(n)) return 'it';
  if (/hostel|hall|dorm|residen/.test(n)) return 'hostel';
  if (/library|books?/.test(n)) return 'library';
  if (/cafe|canteen|food|kitchen|dining/.test(n)) return 'cafeteria';
  if (/bus|transport|parking|shuttle|travel/.test(n)) return 'transport';
  if (/facilit|building|maintenance|campus|office/.test(n)) return 'facilities';
  return null;
}

/** Create the sample boxes for a user and fill them with ~75 days of history. */
export function seedSampleData(userId: number) {
  const now = Date.now();
  const DAYS = 75;

  tx(() => {
    const insertBox = db.prepare('INSERT INTO boxes (user_id, name, slug, description, color, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    const boxes = SAMPLE_BOXES.map((b) => {
      const id = Number(insertBox.run(userId, b.name, slugify(b.name), b.description, b.color, now - (DAYS + 5) * 86_400_000).lastInsertRowid);
      return { ...b, id };
    });

    const insertEvent = db.prepare('INSERT INTO events (problem_id, user_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?)');
    const finish = db.prepare('UPDATE problems SET status = ?, updated_at = ?, first_response_at = ?, resolved_at = ? WHERE id = ?');

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    for (let d = DAYS; d >= 0; d--) {
      const dayStart = startOfToday.getTime() - d * 86_400_000;
      const date = new Date(dayStart);
      const weekend = date.getDay() === 5 || date.getDay() === 6; // Friday & Saturday weekend
      const progress = 1 - d / DAYS; // 0 → 1 as we approach today
      let count = Math.round((weekend ? 3.5 : 8) * (0.75 + 0.45 * progress) + rand(-2, 2.5));
      const outage = d >= 15 && d <= 18; // a Wi-Fi outage spike a couple of weeks ago
      if (outage) count += 7;

      for (let i = 0; i < Math.max(1, count); i++) {
        const box = outage && i < 7 ? boxes.find((b) => b.key === 'it')! : pickWeighted(boxes);
        const t = outage && i < 7 ? { ...drawTemplate('it'), ...wifiOutage() } : drawTemplate(box.key);
        const hour = pickWeighted(HOUR_ITEMS).hour;
        const createdAt = dayStart + hour * 3_600_000 + Math.floor(Math.random() * 3_600_000);
        if (createdAt > now - 5 * 60_000) continue;

        const flag = triage(t.title, t.body);
        let priority: Priority = flag.priority ?? t.priority;
        if (!flag.priority && Math.random() < 0.15) priority = pick(['high', 'normal', 'low']);

        const id = insertProblem({
          boxId: box.id,
          title: t.title,
          body: t.body,
          category: t.category,
          priority,
          author: Math.random() < 0.3 ? pick(NAMES) : null,
          source: 'sample',
          autoFlag: flag.reason,
          createdAt,
        });

        // Decide how far through the workflow this problem got, based on its age.
        const ageH = (now - createdAt) / 3_600_000;
        const speed = priority === 'urgent' ? 0.3 : priority === 'high' ? 0.6 : priority === 'low' ? 1.5 : 1;
        const firstAt = createdAt + Math.max(0.15, lognormal(10 - 7 * progress, 0.8) * speed) * 3_600_000;
        const resolvedAt = firstAt + Math.max(0.5, lognormal(48 - 26 * progress, 0.85) * speed) * 3_600_000;

        let status: Status = 'new';
        const r = Math.random();
        const untouched = firstAt > now || (ageH < 40 && Math.random() < 0.5);
        if (!untouched) status = resolvedAt >= now ? 'in_progress' : r < 0.08 ? 'dismissed' : r < 0.92 ? 'resolved' : 'in_progress';
        if (status === 'in_progress' && ageH > 24 * 20) status = 'resolved';

        if (status === 'new') continue;

        const doneAt = status === 'resolved' || status === 'dismissed' ? Math.min(resolvedAt, now - 60_000) : null;
        insertEvent.run(id, userId, 'status', JSON.stringify({ from: 'new', to: 'in_progress' }), firstAt);
        if (Math.random() < 0.55) {
          const noteAt = firstAt + (doneAt ? (doneAt - firstAt) * 0.4 : 10 * 60_000);
          if (noteAt < now) insertEvent.run(id, userId, 'note', JSON.stringify({ text: pick(NOTES) }), noteAt);
        }
        if (doneAt) {
          insertEvent.run(id, userId, 'status', JSON.stringify({ from: 'in_progress', to: status }), doneAt);
        }
        finish.run(status, doneAt ?? firstAt, firstAt, status === 'resolved' ? doneAt : null, id);
      }
    }

    db.prepare('UPDATE users SET demo_feed = 1 WHERE id = ?').run(userId);
  });
}

function wifiOutage() {
  return pick([
    { title: 'Wi-Fi down across campus', body: 'No internet in any building since this morning. Online quiz is in an hour.', priority: 'high' as Priority },
    { title: 'Campus Wi-Fi not connecting at all', body: 'It connects but there is no internet. Tried on three devices.', priority: 'high' as Priority },
    { title: 'Internet outage in the hostels', body: 'Whole hall has had no internet since last night.', priority: 'high' as Priority },
  ]);
}

/** A believable fresh submission for the live demo feed, routed to a matching box when possible. */
export function demoSubmission(boxes: { id: number; name: string }[]) {
  const box = pick(boxes);
  const key = boxKeyFor(box.name) ?? pick(SAMPLE_BOXES).key;
  const t = drawTemplate(key);
  const flag = triage(t.title, t.body);
  return {
    boxId: box.id,
    title: t.title,
    body: t.body,
    category: t.category,
    priority: flag.priority ?? t.priority,
    autoFlag: flag.reason,
    author: Math.random() < 0.3 ? pick(NAMES) : null,
  };
}
