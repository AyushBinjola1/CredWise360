// Adds academy progress, a support ticket and a fairness run to the demonstration data, through the real REST workflows.
// Idempotent. Run after scripts/seed-demo.mjs:  WEB_URL=http://127.0.0.1:3000 node scripts/seed-demo-extras.mjs
import {client} from '../tests/helpers.mjs';

const PASSWORD = 'CredWiseDemo!360';
async function login(email) {
  const session = client();
  await session.post('auth/login', {email, password: PASSWORD});
  return session;
}
const admin = await login('admin@credwise.test');
let changed = 0;

// The demo borrower completes the first three lessons.
const borrower = await login('borrower@credwise.test');
const lessons = (await borrower.get('academy?lang=en')).data.items;
for (const lesson of lessons.slice(0, 3).filter(l => !l.completed)) {
  for (let choice = 0; choice < 4; choice++) {
    const answer = (await borrower.post(`academy/${lesson.slug}/answer`, {choice, lang: 'en'})).data;
    if (answer.correct) { changed++; break; }
  }
}
await borrower.get('rewards');

// Diya asks for her rejected application to be reconsidered and the administrator requests more evidence.
const diya = await login('diya.nair@credwise.test');
if ((await diya.get('disputes')).data.items.length === 0) {
  const rejected = (await diya.get('applications?status=rejected')).data.items[0];
  if (rejected) {
    const ticket = (await diya.post('disputes', {category: 'application_reconsideration', subject: 'Please reconsider my wedding loan',
      description: 'My monthly instalments have fallen since the decision and I would like a person to review the application again.',
      application_id: rejected.id}, 201)).data.ticket;
    await admin.post(`admin/disputes/${ticket.id}/assign`, {});
    await admin.post(`admin/disputes/${ticket.id}/respond`, {status: 'awaiting_customer', body: 'Thank you. Please upload your latest payslip and a note on the reduced instalments.'});
    changed++;
  }
}

// A first fairness run so the monitor opens with evidence, and one distress refresh so the watch list is populated.
if ((await admin.get('admin/fairness')).data.history.length === 0) { await admin.post('admin/fairness/run', {}, 201); changed++; }
await admin.get('admin/distress');
console.log(changed ? 'Added demonstration data for the academy, support tickets and fairness monitor.' : 'Demonstration extras already present.');
