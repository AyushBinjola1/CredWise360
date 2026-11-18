import {test} from 'node:test';
import assert from 'node:assert/strict';
import {client, registerCustomer} from './helpers.mjs';

function reconcile(quote) {
  let balance = quote.principal;
  let interest = 0;
  let paid = 0;
  for (const [index, row] of quote.schedule.entries()) {
    assert.equal(row.month, index + 1);
    assert.ok(Number.isSafeInteger(row.principal) && row.principal >= 0 && row.principal <= balance);
    assert.equal(row.payment, row.principal + row.interest + row.prepayment_fee);
    balance -= row.principal;
    assert.equal(row.balance, balance);
    paid += row.payment;
    interest += row.interest;
  }
  assert.equal(balance, 0);
  assert.equal(interest, quote.total_interest);
  assert.equal(paid, quote.total_repayment);
  assert.equal(quote.actual_months, quote.schedule.length);
  assert.equal(quote.total_cost, paid + quote.fee + quote.upfront);
  assert.equal(quote.borrowing_cost, quote.total_cost - quote.principal);
}

test('the public market serves eight distinct, configured product policies and details', async () => {
  const session = client();
  const {data: {items}} = await session.get('products');
  assert.deepEqual(items.map(item => item.slug),
    ['personal','education','home','vehicle','business','gold','emergency','microfinance']);
  for (const product of items) {
    const {data: details} = await session.get('products/' + product.slug);
    assert.deepEqual(details, product);
    assert.ok(product.min_amount > 0 && product.max_amount >= product.min_amount);
    assert.ok(product.min_months > 0 && product.max_months >= product.min_months);
    assert.ok(product.documents.length && product.collateral && product.risk_policy && product.prepayment_terms);
  }
  await session.get('products/absent', 404);
});

test('reducing, zero, flat, prepayment and rate-reset quotes reconcile to the paise', async () => {
  const session = client();
  const calculate = async body => (await session.post('calculate', body)).data;
  const free = await calculate({principal: 10000, months: 3, rate_bps: 0});
  assert.deepEqual(free.schedule.map(row => row.payment), [3333,3333,3334]);
  assert.equal(free.effective_rate, 0);
  const exact = await calculate({principal: 100000, months: 1, rate_bps: 1200, fee_bps: 100});
  assert.equal(exact.fee, 1000);
  assert.equal(exact.net_proceeds, 99000);
  assert.equal(exact.total_repayment, 101000);
  assert.equal(exact.borrowing_cost, 2000);
  assert.ok(Math.abs(exact.effective_rate - 100 * ((101000 / 99000) ** 12 - 1)) < 1e-7);
  const base = {principal: 1200000, months: 12, rate_bps: 1200};
  const fixed = await calculate({...base, method: 'fixed'});
  const flat = await calculate({...base, method: 'flat'});
  const stepped = await calculate({...base, method: 'floating', next_rate_bps: 1800, rate_month: 5});
  const partial = await calculate({...base, prepayment: 250000, prepay_month: 3});
  const settled = await calculate({...base, prepayment: base.principal, prepay_month: 3});
  for (const q of [free, exact, fixed, flat, stepped, partial, settled]) reconcile(q);
  assert.equal(flat.total_interest, 144000);
  assert.ok(flat.total_interest > fixed.total_interest);
  assert.deepEqual(stepped.schedule.slice(0,4), fixed.schedule.slice(0,4));
  assert.equal(stepped.schedule[4].rate_bps, 1800);
  assert.equal(partial.schedule[2].prepayment, 250000);
  assert.ok(partial.total_interest < fixed.total_interest);
  assert.equal(settled.actual_months, 3);
  assert.equal(settled.schedule.at(-1).balance, 0);
  for (const bad of [{principal: 0}, {months: 0}, {rate_bps: -1}, {upfront: base.principal},
      {prepayment: 100}, {method: 'floating'}, {next_rate_bps: 800}, {rate_month: 15, next_rate_bps: 100}]) {
    await session.post('calculate', {...base, ...bad}, 422);
  }
});

test('product-linked calculator applies fee caps, prepayment timing and charges', async () => {
  const session = client();
  const product = (await session.get('products/personal')).data;
  const body = {product_slug: 'personal', principal: product.max_amount, months: product.max_months,
    prepayment: 500000, prepay_month: product.prepayment_from_month};
  const {data} = await session.post('calculate', body);
  reconcile(data);
  const proportionalFee = Math.round(body.principal * product.fee_bps / 10000);
  assert.equal(data.fee, product.fee_cap ? Math.min(proportionalFee, product.fee_cap) : proportionalFee);
  assert.equal(data.prepayment_fees, Math.round(500000 * product.prepayment_fee_bps / 10000));
  if (product.prepayment_from_month > 1) await session.post('calculate', {...body, prepay_month: 1}, 422);
});

test('public comparisons preserve chosen principal and term and expose eligibility limits', async () => {
  const session = client();
  const body = {slugs: ['personal','education','home','vehicle'], principal: 5000000, months: 24, terms: {education: 36}};
  const {data: {items}} = await session.post('compare', body);
  assert.equal(items.length, 4);
  assert.equal(items[1].quote.months, 36);
  assert.equal(items[0].quote.months, 24);
  assert.equal(items[0].eligible, true);
  assert.equal(items[2].eligible, false);
  for (const item of items) {
    assert.equal(item.eligibility_scope, 'amount_and_term');
    assert.equal(item.quote.principal, body.principal);
    assert.ok(item.reasons.length > 0);
    reconcile(item.quote);
  }
  await session.post('compare', {...body, slugs: [...body.slugs, 'gold']}, 422);
  await session.post('compare', {...body, slugs: ['personal','personal']}, 422);
  await session.post('compare', {...body, terms: {other: 12}}, 422);
  await session.post('compare', {slugs: ['missing'], principal: body.principal, months: 24}, 404);
});

test('recommendations use purpose, current affordability and thin-file review without raising the amount', async () => {
  const want = {purpose: 'personal household repair', principal: 5000000, months: 24};
  await client().post('recommendations', want, 401);
  const {session} = await registerCustomer('market');
  await session.put('profile', {salary: 8000000, essential: 1800000, stability_months: 30,
    savings: 1000000, reserves: 10000000, credit_months: 40, on_time: 32, income_regularity: 95});
  const first = (await session.post('recommendations', want)).data;
  assert.ok(first.items.some(item => item.product.slug === 'personal' && item.eligible));
  for (const item of [...first.items, ...first.alternatives]) {
    assert.equal(item.quote.principal, want.principal);
    assert.ok(item.compatibility >= 0 && item.compatibility <= 100 && item.reasons.length);
  }
  await session.put('profile', {credit_months: 0, on_time: 0, consent: false});
  const thin = (await session.post('recommendations', want)).data;
  assert.ok(thin.items.some(item => item.product.slug === 'personal' && item.human_review));
  await session.put('profile', {salary: 10000});
  const limited = (await session.post('recommendations', want)).data;
  assert.equal(limited.items.length, 0);
  assert.match(limited.alternatives.find(x => x.product.slug === 'personal').reasons.join(' '), /income|budget/i);
});

test('administrator changes are durable, role restricted, version checked and reflected in public quotes', async () => {
  const {session: customer} = await registerCustomer('market-access');
  await customer.get('admin/products/emergency', 403);
  await customer.put('admin/products/emergency', {rate_bps: 10}, 403);
  const admin = client();
  await admin.post('auth/login', {email: 'admin@credwise.test', password: 'CredWiseDemo!360'});
  const old = (await admin.get('admin/products/emergency')).data;
  await admin.put('admin/products/emergency', {min_months: old.max_months + 1}, 422);
  const newRate = old.rate_bps === 6000 ? 5999 : old.rate_bps + 1;
  const changed = (await admin.put('admin/products/emergency', {rate_bps: newRate, base_updated_at: old.updated_at})).data;
  try {
    assert.equal((await client().get('products/emergency')).data.rate_bps, newRate);
    const testQuote = (await client().post('calculate', {product_slug: 'emergency', principal: 1000000, months: 6})).data;
    assert.equal(testQuote.schedule[0].rate_bps, newRate);
    await admin.put('admin/products/emergency', {rate_bps: old.rate_bps, base_updated_at: old.updated_at}, 409);
  } finally {
    await admin.put('admin/products/emergency', {rate_bps: old.rate_bps, base_updated_at: changed.updated_at});
  }
  assert.equal((await customer.get('products/emergency')).data.rate_bps, old.rate_bps);
});
