'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  ArrowLeft, ArrowRight, BadgeIndianRupee, BriefcaseBusiness, CarFront, Check,
  ChevronLeft, ChevronRight, CircleHelp, Coins, FileCheck2, Gem, GitCompareArrows,
  GraduationCap, House, Landmark, ListFilter, Search, ShieldCheck, SlidersHorizontal, Sprout,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, errText, human, money, useResource } from '@/lib/api';
import { Button } from './ui/button';
import { Empty, Failure, Loading, Metric, PageHeading } from './states';
import './marketplace.css';

type Product = {
  slug: string; name: string; description: string; min_amount: number; max_amount: number;
  min_months: number; max_months: number; rate_bps: number; fee_bps: number;
  documents: string[]; collateral: string; prepayment_terms: string; risk_policy: string;
  purposes: string[]; method: string; min_score: number; min_income: number; max_emi_percent: number;
  min_stability_months: number; late_fee: number; prepayment_from_month: number; prepayment_fee_bps: number;
};
type ScheduleRow = { month: number; payment: number; interest: number; principal: number; balance: number };
type Quote = {
  emi: number; total_interest: number; total_repayment: number; fee: number; total_cost: number;
  effective_rate: number | null; schedule: ScheduleRow[]; principal: number; upfront: number;
  borrowing_cost: number; net_proceeds: number; months: number; actual_months: number; prepayment_fees: number;
};
type MatchedProduct = {
  product: Product; quote: Quote | null; eligible: boolean; human_review: boolean; reasons: string[];
  warnings: string[]; compatibility: number;
};
type ProductList = { items: Product[] };
type QuoteBody = {
  principal: number; months: number; rate_bps: number; fee_bps: number; upfront: number; method: string;
  product_slug?: string; prepayment?: number; prepay_month?: number; next_rate_bps?: number; rate_month?: number;
};
const productIcons: Record<string, LucideIcon> = {
  personal: BadgeIndianRupee, education: GraduationCap, home: House, vehicle: CarFront,
  business: BriefcaseBusiness, gold: Gem, emergency: ShieldCheck, microfinance: Sprout,
};
function productKind(slug: string) { return slug.replace(/-loan$/, ''); }
function iconFor(product: Product) { return productIcons[productKind(product.slug)] ?? Landmark; }
const decimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
function percent(value: number) { return decimal.format(value / 100) + '%'; }
function termRange(p: Product) { return p.min_months + '–' + p.max_months + ' months'; }
function amountRange(p: Product) { return money(p.min_amount) + '–' + money(p.max_amount); }
function productHref(product: Product, signedIn: boolean) { return (signedIn ? '/app/market/' : '/products/') + encodeURIComponent(product.slug); }

function toMinor(raw: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return NaN;
  const units = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(units) ? units : NaN;
}
function whole(raw: string) { return /^\d+$/.test(raw.trim()) ? Number(raw) : NaN; }
function inRange(value: number, min: number, max: number) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}
function ruleText(rule: string | undefined) { return rule ? human(rule) : ''; }

/** Only sent scenarios appear in the cache. The service owns every figure shown here. */
function useProjection<T>(endpoint: string, body: object | null) {
  const input = body === null ? '' : JSON.stringify(body);
  const [settled, setSettled] = useState(input);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(input), 240);
    return () => window.clearTimeout(timer);
  }, [input]);
  const query = useQuery({
    queryKey: ['api', endpoint, settled],
    queryFn: ({ signal }) => api<T>(endpoint, JSON.parse(settled), 'POST', signal),
    enabled: Boolean(input) && input === settled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  return { ...query, updating: input !== settled || query.isFetching };
}

function NumberControl({ label, value, change, min, max, step = 1, unit, rangeMax, rangeStep, help }: {
  label: string; value: string; change: (value: string) => void; min: number; max: number; step?: number;
  unit?: string; rangeMax?: number; rangeStep?: number; help?: string;
}) {
  const id = useId();
  const rangeValue = Math.min(Math.max(Number(value) || min, min), rangeMax ?? max);
  return <div className="market-field"><label htmlFor={id}>{label}</label>
    <div className="market-number">{unit === '₹' && <span aria-hidden="true">₹</span>}
      <input id={id} type="number" inputMode={step < 1 ? 'decimal' : 'numeric'} value={value} min={min} max={max} step={step}
        required aria-describedby={help ? id + '-hint' : undefined} onChange={event => change(event.target.value)}/>
      {unit && unit !== '₹' && <span aria-hidden="true">{unit}</span>}</div>
    {rangeMax !== undefined && <input type="range" min={min < 1 && (rangeStep ?? 0) >= 1 ? rangeStep : min} max={rangeMax} step={rangeStep ?? step}
      value={rangeValue} aria-label={'Adjust ' + label.toLowerCase()} onChange={event => change(event.target.value)}/>}
    {help && <small id={id + '-hint'}>{help}</small>}
  </div>;
}

function ProductCard({ product, signedIn }: { product: Product; signedIn: boolean }) {
  const Icon = iconFor(product);
  return <article className="market-product"><div className="market-product-icon"><Icon size={23}/></div>
    <h2><Link href={productHref(product, signedIn)}>{product.name}</Link></h2><p>{product.description}</p>
    <dl className="market-prices"><div><dt>Annual rate</dt><dd>{percent(product.rate_bps)}</dd></div>
      <div><dt>Term</dt><dd>{termRange(product)}</dd></div></dl>
    <Link className="market-more" href={productHref(product, signedIn)} aria-label={'View ' + product.name + ' details'}>View details<ArrowRight size={15}/></Link>
  </article>;
}

function ProductDetail({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const query = useResource<Product>('products/' + encodeURIComponent(slug));
  if (query.isPending) return <Loading/>;
  const back = signedIn ? '/app/market' : '/products';
  if (query.error) return <div className="market-page"><Link className="market-back" href={back}><ArrowLeft size={15}/>All products</Link><Failure message={errText(query.error)} retry={() => query.refetch()}/></div>;
  const product = query.data;
  const Icon = iconFor(product);
  const kind = productKind(product.slug);
  return <div className="market-page"><Link className="market-back" href={back}><ArrowLeft size={15}/>All products</Link>
    <div className="market-detail-hero"><div><span className="eyebrow"><i/> Loan product</span><h1>{product.name}</h1><p>{product.description}</p>
      <div className="market-links">{signedIn&&<Button asChild><Link href={'/app/applications/new?product='+encodeURIComponent(product.slug)}>Start application<ArrowRight size={16}/></Link></Button>}<Button asChild variant={signedIn?'outline':'default'}><Link href={'/calculator?product=' + encodeURIComponent(product.slug)}>Estimate a repayment<ArrowRight size={16}/></Link></Button>
      <Button asChild variant="outline"><Link href={'/compare?product=' + encodeURIComponent(product.slug)}><GitCompareArrows size={16}/>Compare options</Link></Button></div>
    </div>{kind === 'education' ? <img src="/images/campus-planning.webp" alt="A student reads a workbook on a shaded campus bench." width={1536} height={1024}/> :
      <div className="market-detail-symbol" aria-hidden="true"><Icon size={68} strokeWidth={1.25}/></div>}</div>
    <div className="market-metrics"><Metric label="Annual interest rate" value={percent(product.rate_bps)}/><Metric label="Processing fee" value={percent(product.fee_bps)}/>
      <Metric label="Available term" value={termRange(product)}/><Metric label="Principal range" value={amountRange(product)}/></div>
    <div className="market-policy-grid">
      <section className="market-panel"><FileCheck2 className="market-section-icon" size={23}/><h2>Required documents</h2>
        <ul className="market-document-list">{product.documents.map(doc => <li key={doc}><Check size={15}/>{human(doc)}</li>)}</ul>
        <p className="market-note">Use synthetic documents for the demonstration.</p>
      </section><section className="market-panel"><ShieldCheck className="market-section-icon" size={23}/><h2>Product terms</h2>
        <dl className="market-facts"><div><dt>Collateral</dt><dd>{product.collateral}</dd></div>
          {product.method && <div><dt>Interest method</dt><dd>{human(product.method)}</dd></div>}
          <div><dt>Simulated score threshold</dt><dd>{product.min_score}</dd></div>
          <div><dt>Monthly income threshold</dt><dd>{money(product.min_income)}</dd></div>
          <div><dt>Minimum work stability</dt><dd>{product.min_stability_months} months</dd></div>
          <div><dt>Instalment-to-income limit</dt><dd>{product.max_emi_percent}%</dd></div>
          <div><dt>Prepayment</dt><dd>{ruleText(product.prepayment_terms)}</dd></div>
          <div><dt>Configured late charge</dt><dd>{money(product.late_fee)}</dd></div>
          <div><dt>Risk policy</dt><dd>{ruleText(product.risk_policy)}</dd></div>
        </dl></section>
    </div><p className="market-disclosure"><CircleHelp size={16}/>Products, rates and eligibility criteria are demonstration data.</p>
  </div>;
}

function Recommendations({ products }: { products: Product[] }) {
  const first = products.find(p => productKind(p.slug) === 'personal') ?? products[0];
  const [purpose, setPurpose] = useState(productKind(first.slug));
  const [amount, setAmount] = useState('100000');
  const [months, setMonths] = useState('24');
  const [request, setRequest] = useState<{ purpose: string; principal: number; months: number } | null>(null);
  const query = useProjection<{ items: MatchedProduct[]; alternatives: MatchedProduct[] }>('recommendations', request);
  return <section className="market-panel market-recs"><div className="market-panel-heading"><div><span className="eyebrow"><i/> Personalised to your profile</span><h2>Find a suitable loan</h2>
    <p>Compare matches for the amount you need and the term you want.</p></div><SlidersHorizontal size={23}/></div>
    <form className="market-recommend-form" onSubmit={event => { event.preventDefault(); setRequest({ purpose, principal: toMinor(amount), months: whole(months) }); }}>
      <label className="market-field">Loan purpose<select value={purpose} onChange={event => setPurpose(event.target.value)}>{products.map(p =>
        <option key={p.slug} value={productKind(p.slug)}>{p.name}</option>)}</select></label>
      <NumberControl label="Requested amount" value={amount} change={setAmount} min={1} max={1000000000} step={0.01} unit="₹"/>
      <NumberControl label="Requested term" value={months} change={setMonths} min={1} max={600} unit="months"/>
      <Button type="submit" disabled={query.updating && Boolean(request)}>Find matches<ArrowRight size={16}/></Button>
    </form>
    {request && <div className="market-matches" aria-live="polite">{query.updating || query.isPending ? <Loading/> : query.error ?
      <Failure message={errText(query.error)} retry={() => query.refetch()}/> :
      <>{query.data.items.length === 0 ? <Empty title="No products fit these inputs">Review the requested amount and term, or update the evidence in your financial profile.</Empty> :
        <h3>Matches for {money(request.principal)} over {request.months} months</h3>}
      {query.data.items.map(item => <article key={item.product.slug} className="market-match"><div className="market-match-top"><h4><Link href={productHref(item.product, true)}>{item.product.name}</Link></h4>
        <span className="market-chip">{item.compatibility}% match{item.human_review ? ' · Human review' : ''}</span></div>
        {item.quote && <dl className="market-inline-stats"><div><dt>Monthly EMI</dt><dd>{money(item.quote.emi)}</dd></div><div><dt>Total interest</dt><dd>{money(item.quote.total_interest)}</dd></div><div><dt>Total cost</dt><dd>{money(item.quote.total_cost)}</dd></div></dl>}
        {item.reasons?.length > 0 && <ul className="market-reasons">{item.reasons.map((reason,i) => <li key={i}>{reason}</li>)}</ul>}
        {item.warnings?.length > 0 && <p className="market-warning">{item.warnings.join(' ')}</p>}
        <Link className="market-more" href={productHref(item.product, true)}>Review terms<ArrowRight size={14}/></Link>
      </article>)}
      {query.data.alternatives?.length > 0 && <details className="market-alternatives"><summary>Other products considered ({query.data.alternatives.length})</summary>
        {query.data.alternatives.map(item => <div key={item.product.slug}><Link className="market-more" href={productHref(item.product, true)}>{item.product.name}<ArrowRight size={14}/></Link>
          <p>{[...item.reasons, ...(item.warnings ?? [])].join(' ')}</p></div>)}</details>}</>}</div>}
  </section>;
}

function Schedule({ rows }: { rows: ScheduleRow[] }) {
  const [page, setPage] = useState(1);
  const count = Math.max(1, Math.ceil(rows.length / 12));
  const current = Math.min(page, count);
  function download() {
    const columns: (keyof ScheduleRow)[] = ['month', 'payment', 'interest', 'principal', 'balance'];
    const csv = ['Month,Payment (INR),Interest (INR),Principal (INR),Balance (INR)',
      ...rows.map(row => columns.map(key => key === 'month' ? row.month : (row[key] / 100).toFixed(2)).join(','))].join('\r\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = href; link.download = 'credwise-repayment-schedule.csv';
    document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return <section className="market-panel market-schedule"><div className="market-panel-heading"><div><h2>Monthly repayment schedule</h2>
    <p>{rows.length} {rows.length === 1 ? 'instalment' : 'instalments'} in this scenario.</p></div>
    <Button size="small" variant="outline" type="button" onClick={download}>Download CSV</Button></div>
    <div className="market-table-scroll" tabIndex={0} role="region" aria-label="Monthly repayment schedule table">
      <table><thead><tr>{['Month', 'Payment', 'Interest', 'Principal', 'Closing balance'].map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
        <tbody>{rows.slice((current - 1) * 12, current * 12).map(row => <tr key={row.month}><th scope="row">{row.month}</th><td>{money(row.payment)}</td><td>{money(row.interest)}</td>
          <td>{money(row.principal)}</td><td>{money(row.balance)}</td></tr>)}</tbody></table></div>
    {count > 1 && <div className="market-pagination"><span>Page {current} of {count}</span><Button variant="outline" size="small" type="button" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={15}/>Previous</Button>
      <Button variant="outline" size="small" type="button" disabled={current >= count} onClick={() => setPage(current + 1)}>Next<ChevronRight size={15}/></Button></div>}
  </section>;
}

function QuoteResult({ quote, principal }: { quote: Quote; principal: number }) {
  const chart = [{ month: 0, balance: principal }, ...quote.schedule];
  const gradient = useId().replace(/:/g, '');
  return <><section className="market-estimate" aria-label="Repayment estimate"><div className="market-estimate-top">
    <div><span>Estimated monthly EMI</span><strong data-testid="calculated-emi">{money(quote.emi)}</strong></div><span className="market-estimate-icon"><Coins size={30} strokeWidth={1.4}/></span></div>
    <div className="market-estimate-bottom"><div><span>Total interest</span><strong>{money(quote.total_interest)}</strong></div>
      <div><span>Total including charges</span><strong>{money(quote.total_cost)}</strong></div></div></section>
    <section className="market-panel market-balance-chart"><div className="market-panel-heading"><div><h2>Outstanding balance</h2><p>The remaining principal after each payment.</p></div></div>
      <div className="market-chart" role="img" aria-label={'Outstanding principal declines from ' + money(principal) + ' to ' + money(quote.schedule.at(-1)?.balance ?? principal) + '. Monthly values follow in the schedule.'}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1}><AreaChart data={chart} margin={{ top: 8, right: 9, left: 0, bottom: 0 }}>
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#619673" stopOpacity={0.4}/><stop offset="100%" stopColor="#619673" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5"/>
          <XAxis dataKey="month" type="number" domain={[0, 'dataMax']} allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="var(--muted)" tickFormatter={value => 'M' + value}/>
          <YAxis width={53} axisLine={false} tickLine={false} stroke="var(--muted)" fontSize={11} tickFormatter={value => '₹' + compact.format(Number(value) / 100)}/>
          <Tooltip labelFormatter={value => 'Month ' + value} formatter={value => [money(Number(value)), 'Balance']} contentStyle={{ borderColor: 'var(--line)', background: 'var(--surface)', borderRadius: 7, color: 'var(--ink)' }}/>
          <Area isAnimationActive={false} dataKey="balance" type="linear" stroke="var(--green)" strokeWidth={2.5} fill={'url(#' + gradient + ')'}/>
        </AreaChart></ResponsiveContainer></div></section>
    <section className="market-panel market-costs"><h2>Cost breakdown</h2><dl className="market-facts">
      <div><dt>Amount borrowed</dt><dd>{money(principal)}</dd></div><div><dt>Net proceeds after charges</dt><dd>{money(quote.net_proceeds)}</dd></div>
      <div><dt>Processing fee</dt><dd>{money(quote.fee)}</dd></div><div><dt>Other upfront charges</dt><dd>{money(quote.upfront)}</dd></div>
      {quote.prepayment_fees > 0 && <div><dt>Prepayment charges</dt><dd>{money(quote.prepayment_fees)}</dd></div>}
      <div><dt>Total instalments</dt><dd>{money(quote.total_repayment)}</dd></div><div><dt>Interest and charges combined</dt><dd>{money(quote.borrowing_cost)}</dd></div>
      <div><dt>Estimated effective annual cost</dt><dd>{quote.effective_rate == null ? 'Unavailable' : decimal.format(quote.effective_rate) + '%'}</dd></div></dl>
      <p className="market-note">The effective annual cost uses net proceeds and the timing of repayments.</p></section>
  </>;
}

function Calculator({ product, products, choose }: { product?: Product; products: Product[]; choose: (slug: string) => void }) {
  const startPrincipal = Math.max(product?.min_amount ?? 1, Math.min(10_000_000, product?.max_amount ?? 10_000_000));
  const startMonths = Math.max(product?.min_months ?? 1, Math.min(24, product?.max_months ?? 600));
  const [amount, setAmount] = useState(String(startPrincipal / 100)), [months, setMonths] = useState(String(startMonths));
  const [rate, setRate] = useState(String((product?.rate_bps ?? 1200) / 100)), [fee, setFee] = useState(String((product?.fee_bps ?? 0) / 100));
  const [upfront, setUpfront] = useState('0'), [method, setMethod] = useState(product?.method === 'flat' ? 'flat' : 'reducing');
  const [prepay, setPrepay] = useState(false), [extra, setExtra] = useState('10000'), [extraMonth, setExtraMonth] = useState(String(Math.min(6, startMonths)));
  const [nextRate, setNextRate] = useState('13'), [rateMonth, setRateMonth] = useState(String(Math.min(12, startMonths)));
  const principal = toMinor(amount), term = whole(months), bps = toMinor(rate), feeBps = toMinor(fee), charge = toMinor(upfront);
  let valid = inRange(principal, 1, 100_000_000_000) && inRange(term, 1, 600) && inRange(bps, 0, 6000)
    && inRange(feeBps, 0, 5000) && inRange(charge, 0, 100_000_000_000);
  const body: QuoteBody = { principal, months: term, rate_bps: bps, fee_bps: feeBps, upfront: charge, method };
  if (product) body.product_slug = product.slug;
  if (method === 'floating') {
    body.next_rate_bps = toMinor(nextRate); body.rate_month = whole(rateMonth);
    valid &&= inRange(body.next_rate_bps, 0, 6000) && inRange(body.rate_month, 1, term);
  }
  if (prepay) {
    body.prepayment = toMinor(extra); body.prepay_month = whole(extraMonth);
    valid &&= inRange(body.prepayment, 1, 100_000_000_000) && inRange(body.prepay_month, 1, term);
  }
  const query = useProjection<Quote>('calculate', valid ? body : null);
  const ready = valid && !query.isPending && !query.error;
  return <div className="market-page"><PageHeading kicker="Borrowing tools" title="Loan calculator" description="Adjust an amount, interest rate and term to explore your monthly payment and the full cost of borrowing."/>
    <div className="market-calculator-layout"><section className="market-panel market-controls"><div className="market-panel-heading"><div><h2>Loan assumptions</h2></div><SlidersHorizontal size={21}/></div>
      <label className="market-field">Starting product<select value={product?.slug ?? ''} onChange={event => choose(event.target.value)}><option value="">Custom scenario</option>
        {products.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
      <NumberControl label="Loan amount" value={amount} change={setAmount} min={0.01} max={1000000000} step={0.01} unit="₹" rangeMax={Math.max(1000000, startPrincipal / 100)} rangeStep={1000}/>
      <NumberControl label="Annual interest rate" value={rate} change={setRate} min={0} max={60} step={0.01} unit="%" rangeMax={60} rangeStep={0.25}/>
      <NumberControl label="Repayment term" value={months} change={setMonths} min={1} max={600} unit="months" rangeMax={Math.max(120, startMonths)}/>
      <label className="market-field">Interest method<select value={method} onChange={event => setMethod(event.target.value)}>
        <option value="reducing">Fixed rate · reducing balance</option><option value="flat">Flat interest on original principal</option><option value="floating">Floating rate scenario</option></select></label>
      {method === 'floating' && <div className="market-control-pair"><NumberControl label="Revised annual rate" value={nextRate} change={setNextRate} min={0} max={60} step={0.01} unit="%"/>
        <NumberControl label="First month at revised rate" value={rateMonth} change={setRateMonth} min={1} max={term || 600}/></div>}
      <details className="market-advanced"><summary>Fees and prepayment</summary><div className="market-advanced-content">
        <NumberControl label="Processing fee" value={fee} change={setFee} min={0} max={50} step={0.01} unit="%"/>
        <NumberControl label="Other upfront charges" value={upfront} change={setUpfront} min={0} max={1000000000} step={0.01} unit="₹"/>
        <label className="market-check"><input type="checkbox" checked={prepay} onChange={event => setPrepay(event.target.checked)}/>Model an extra payment</label>
        {prepay && <><NumberControl label="Extra payment" value={extra} change={setExtra} min={0.01} max={1000000000} step={0.01} unit="₹"/>
          <NumberControl label="Extra payment month" value={extraMonth} change={setExtraMonth} min={1} max={term || 600}/></>}
      </div></details><p className="market-note">{product ? 'This scenario uses the selected product’s processing fee cap and prepayment conditions.' : 'Custom scenarios use the rates and charges you enter.'}</p>
    </section><div className="market-calculator-output" aria-busy={valid && query.updating}>
      {!valid ? <div className="market-panel"><Empty title="Check the loan assumptions">Enter a positive amount, a term from 1–600 months and rates within the displayed ranges. Payment and rate changes must fall inside the term.</Empty></div>
        : query.isPending ? <div className="market-panel"><Loading/></div> : query.error ? <Failure message={errText(query.error)} retry={() => query.refetch()}/> :
        <>{query.updating && <p className="market-note" role="status">Updating your estimate…</p>}<QuoteResult quote={query.data} principal={query.data.principal}/></>}
    </div></div>
    {ready && query.data && <Schedule rows={query.data.schedule}/>}
    <p className="market-disclosure"><CircleHelp size={16}/>Illustrative repayments in Indian rupees. Interest and fees depend on the scenario you enter.</p>
  </div>;
}

function useStartingProduct() {
  const [slug, setSlug] = useState('');
  useEffect(() => { setSlug(new URLSearchParams(window.location.search).get('product') ?? ''); }, []);
  return [slug, setSlug] as const;
}

export function CalculatorPage() {
  const query = useResource<ProductList>('products');
  const [slug, setSlug] = useStartingProduct();
  if (query.isPending) return <Loading/>;
  if (query.error) return <Failure message={errText(query.error)} retry={() => query.refetch()}/>;
  return <Calculator key={slug} product={query.data.items.find(p => p.slug === slug)} products={query.data.items} choose={setSlug}/>;
}

function ComparisonResults({ items }: { items: MatchedProduct[] }) {
  const [measure, setMeasure] = useState<'emi' | 'total_cost' | 'total_interest'>('total_cost');
  const available = items.filter(item => item.eligible && item.quote);
  function highlight(item: MatchedProduct, key: 'emi' | 'total_cost' | 'actual_months', label: string) {
    if (!item.quote || !item.eligible || available.length < 2) return null;
    const lowest = Math.min(...available.map(match => match.quote![key]));
    if (item.quote[key] !== lowest) return null;
    const tied = available.filter(match => match.quote![key] === lowest).length > 1;
    return <small className="market-highlight">{tied ? 'Tied · ' : ''}{label}</small>;
  }
  const best = Math.max(1, ...items.map(item => item.quote?.[measure] ?? 0));
  const metrics: { label: string; render: (item: MatchedProduct) => React.ReactNode }[] = [
    { label: 'Requested principal', render: i => i.quote ? money(i.quote.principal) : '—' },
    { label: 'Annual interest', render: i => percent(i.product.rate_bps) + ' · ' + human(i.product.method) },
    { label: 'Monthly EMI', render: i => i.quote && <>{money(i.quote.emi)}{highlight(i, 'emi', 'Lowest EMI')}</> },
    { label: 'Repayment term', render: i => i.quote && <>{i.quote.actual_months} months{highlight(i, 'actual_months', 'Shortest term')}</> },
    { label: 'Processing charges', render: i => i.quote ? money(i.quote.fee) : '—' },
    { label: 'Total interest', render: i => i.quote ? money(i.quote.total_interest) : '—' },
    { label: 'Total instalments', render: i => i.quote ? money(i.quote.total_repayment) : '—' },
    { label: 'Total including fees', render: i => i.quote && <>{money(i.quote.total_cost)}{highlight(i, 'total_cost', 'Lowest total')}</> },
    { label: 'Effective annual cost', render: i => i.quote?.effective_rate != null ? decimal.format(i.quote.effective_rate) + '%' : '—' },
    { label: 'Product limits', render: i => amountRange(i.product) + ' · ' + termRange(i.product) },
    { label: 'Income and score criteria', render: i => money(i.product.min_income) + ' monthly income · simulated score ' + i.product.min_score },
    { label: 'Collateral', render: i => i.product.collateral },
    { label: 'Prepayment terms', render: i => i.product.prepayment_terms },
    { label: 'Amount and term check', render: i => <><strong className={i.eligible ? 'market-positive' : 'market-warning'}>{i.eligible ? 'Within limits' : 'Outside limits'}</strong>{!i.eligible && <small>{i.reasons.join(' ')}</small>}</> },
  ];
  return <div className="market-comparison-output"><section className="market-panel"><div className="market-panel-heading"><div><h2>Cost at a glance</h2>
    <p>Compare the quoted figures for your chosen amounts and terms.</p></div>
    <label className="market-field">Chart measure<select value={measure} onChange={event => setMeasure(event.target.value as typeof measure)}>
      <option value="total_cost">Total including fees</option><option value="emi">Monthly EMI</option><option value="total_interest">Total interest</option></select></label></div>
    <div className="market-bars">{items.map(item => <div key={item.product.slug}><div className="market-bar-label"><strong>{item.product.name}</strong><span>{item.quote ? money(item.quote[measure]) : 'Unavailable'}</span></div>
      <div className="market-bar-track" aria-hidden="true"><i style={{ width: ((item.quote?.[measure] ?? 0) / best * 100) + '%' }}/></div></div>)}</div>
  </section><section className="market-panel market-compare-table"><div className="market-panel-heading"><div><h2>Side-by-side comparison</h2>
    <p>Highlights compare products within their amount and term limits. A smaller EMI may mean paying for longer.</p></div></div>
    <div className="market-table-scroll" tabIndex={0} role="region" aria-label="Product comparison table"><table><thead><tr><th scope="col">Repayment detail</th>
      {items.map(item => <th key={item.product.slug} scope="col"><Link href={productHref(item.product, false)}>{item.product.name}</Link></th>)}</tr></thead>
      <tbody>{metrics.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{items.map(item => <td key={item.product.slug}>{row.render(item) ?? '—'}</td>)}</tr>)}</tbody>
    </table></div></section></div>;
}

function Comparator({ products, first }: { products: Product[]; first?: string }) {
  const starting = products.find(p => p.slug === first) ?? products.find(p => p.slug === 'personal') ?? products[0];
  const next = products.find(p => p.slug === 'education' && p.slug !== starting.slug) ?? products.find(p => p.slug !== starting.slug);
  const [selected, setSelected] = useState<string[]>([starting.slug, ...(next ? [next.slug] : [])]);
  const [amount, setAmount] = useState('100000'), [months, setMonths] = useState('24');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const principal = toMinor(amount), term = whole(months);
  const overrides: Record<string, number> = {};
  for (const slug of selected) if (custom[slug]?.trim()) overrides[slug] = whole(custom[slug]);
  const valid = inRange(principal, 1, 100_000_000_000) && inRange(term, 1, 600) && selected.length >= 2
    && Object.values(overrides).every(value => inRange(value, 1, 600));
  const body = { slugs: selected, principal, months: term, terms: overrides };
  const query = useProjection<{ items: MatchedProduct[] }>('compare', valid ? body : null);
  function toggle(slug: string) {
    setSelected(previous => previous.includes(slug) ? previous.filter(choice => choice !== slug)
      : previous.length < 4 ? [...previous, slug] : previous);
  }
  return <div className="market-page"><PageHeading kicker="Borrowing tools" title="Compare loan products" description="Put up to four products side by side. See what changes when you adjust the amount or the repayment period."/>
    <section className="market-panel market-config"><div className="market-panel-heading"><div><h2>Build your comparison</h2><p>Choose two to four products and enter a common starting amount.</p></div>
      <span className="market-chip">{selected.length} of 4 selected</span></div>
      <fieldset className="market-product-picks"><legend className="market-sr">Products to compare</legend>{products.map(p => {
        const Icon = iconFor(p), chosen = selected.includes(p.slug);
        return <label key={p.slug} className={chosen ? 'chosen' : ''}><input type="checkbox" checked={chosen} disabled={!chosen && selected.length >= 4} onChange={() => toggle(p.slug)}/>
          <Icon size={16}/><span>{p.name}</span></label>;
      })}</fieldset>
      <div className="market-control-pair"><NumberControl label="Comparison amount" value={amount} change={setAmount} min={0.01} max={1000000000} step={0.01} unit="₹"/>
        <NumberControl label="Common repayment term" value={months} change={setMonths} min={1} max={600} unit="months"/></div>
      {selected.length > 0 && <details className="market-advanced"><summary>Adjust terms by product</summary><div className="market-overrides">{selected.map(slug => <label className="market-field" key={slug}>
        {products.find(p => p.slug === slug)?.name} term<span className="market-number"><input type="number" min={1} max={600} step={1} inputMode="numeric" placeholder={months || 'Common term'}
          value={custom[slug] ?? ''} onChange={event => setCustom({ ...custom, [slug]: event.target.value })}/><span>months</span></span></label>)}</div></details>}
    </section>
    {!valid ? <Empty title={selected.length < 2 ? 'Choose at least two products' : 'Check the comparison inputs'}>{selected.length < 2 ? 'Select another product to compare repayment costs.' : 'Use a positive amount and a whole term from 1–600 months.'}</Empty> :
      query.isPending ? <Loading/> : query.error ? <Failure message={errText(query.error)} retry={() => query.refetch()}/> : <>{query.updating && <p className="market-note" role="status">Updating the comparison…</p>}<ComparisonResults items={query.data.items}/></>}
    <p className="market-disclosure"><CircleHelp size={16}/>Public comparisons use product limits. Personal eligibility also depends on your profile and supporting evidence.</p>
  </div>;
}

export function ComparePage() {
  const query = useResource<ProductList>('products');
  const [starting] = useStartingProduct();
  if (query.isPending) return <Loading/>;
  if (query.error) return <Failure message={errText(query.error)} retry={() => query.refetch()}/>;
  if (!query.data.items.length) return <Empty title="No products available">A comparison needs active loan products.</Empty>;
  return <Comparator key={starting} products={query.data.items} first={starting}/>;
}

export function MarketplacePage({ signedIn = false, slug }: { signedIn?: boolean; slug?: string }) {
  const query = useResource<ProductList>('products', !slug);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('default');
  if (slug) return <ProductDetail signedIn={signedIn} slug={slug}/>;
  if (query.isPending) return <Loading/>;
  if (query.error) return <Failure message={errText(query.error)} retry={() => query.refetch()}/>;
  const products = query.data.items;
  if (products.length === 0) return <Empty title="No products are available">The loan catalogue is empty.</Empty>;
  const results = products.filter(p => (p.name + ' ' + p.description).toLowerCase().includes(search.toLowerCase()));
  if (sort === 'rate') results.sort((a, b) => a.rate_bps - b.rate_bps || a.name.localeCompare(b.name));
  if (sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name));
  const featured = products.find(p => productKind(p.slug) === 'education');
  return <div className="market-page"><PageHeading kicker="Product catalogue" title="Loan marketplace" description="Explore eight ways to borrow. Compare the costs, repayment terms and evidence each product needs."
    action={<Button asChild variant="outline"><Link href="/compare"><GitCompareArrows size={17}/>Compare products</Link></Button>}/>
    {signedIn ? <Recommendations products={products}/> : featured && <section className="market-feature"><div><span className="eyebrow"><i/> Study and tuition</span>
      <h2>Plan for the next semester.</h2><p>{featured.description}</p><Link className="market-feature-link" href={productHref(featured, false)}>Explore the education loan<ArrowRight size={17}/></Link></div>
      <img src="/images/campus-planning.webp" alt="A student reads a workbook on a shaded campus bench." width={1536} height={1024}/></section>}
    <div className="market-filter"><div className="market-search"><Search size={16}/><input aria-label="Search loan products" type="search" placeholder="Search products" value={search} onChange={event => setSearch(event.target.value)}/></div>
      <label className="market-sort"><ListFilter size={15}/>Sort by<select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)}>
        <option value="default">Catalogue order</option><option value="rate">Lowest interest rate</option><option value="name">Product name</option></select></label></div>
    {results.length ? <div className="market-catalogue">{results.map(product => <ProductCard key={product.slug} product={product} signedIn={signedIn}/>)}</div> :
      <Empty title="No matching products">Try another name or purpose.</Empty>}
    <p className="market-disclosure"><CircleHelp size={16}/>All products and interest rates are for this lending simulation.</p>
  </div>;
}
