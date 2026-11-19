'use client';

import { useEffect, useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowDownLeft, ArrowRight, BadgeCheck, BriefcaseBusiness,
  Check, ChevronLeft, ChevronRight, ClipboardCheck, Download,
  FileText, Fingerprint, Landmark, LockKeyhole, Search, ShieldCheck, Upload, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { readSynthetic, saveSynthetic, type SyntheticDocument } from '@/lib/synthetic-document';
import { api, date, errText, human, money, useResource } from '@/lib/api';
import type { FinancialProfile as Profile, ProfileResult } from '@/lib/model';
import { Empty, Failure, Loading, Metric, PageHeading } from './states';
import { Button } from './ui/button';
import './identity-forms.css';

type Field = { key: keyof Profile; label: string; unit: 'money' | 'percent' | 'months' | 'count' | 'text' | 'consent'; hint?: string };
type ProfileSection = { id: string; name: string; icon: LucideIcon; description: string; fields: Field[] };

const sections: ProfileSection[] = [
  { id: 'income', name: 'Income & work', icon: BriefcaseBusiness, description: 'Enter the monthly income you can count on after deductions.', fields: [
    { key: 'employment', label: 'Employment type', unit: 'text', hint: 'For example, salaried, freelance, student or self-employed.' },
    { key: 'stability_months', label: 'Time in current work', unit: 'months' },
    { key: 'salary', label: 'Monthly salary', unit: 'money' },
    { key: 'business_income', label: 'Business or freelance income', unit: 'money' },
    { key: 'other_income', label: 'Other monthly income', unit: 'money' },
    { key: 'income_regularity', label: 'Income regularity', unit: 'percent', hint: 'Enter the percentage of expected payments received. Leave blank if unknown.' },
  ] },
  { id: 'budget', name: 'Monthly budget', icon: Wallet, description: 'Record recurring expenses, savings and existing monthly instalments.', fields: [
    { key: 'essential', label: 'Essential expenses', unit: 'money', hint: 'Housing, food, transport and other necessities.' },
    { key: 'discretionary', label: 'Discretionary expenses', unit: 'money', hint: 'Optional purchases, subscriptions and leisure.' },
    { key: 'existing_emi', label: 'Existing monthly instalments', unit: 'money', hint: 'Enter commitments outside CredWise. Your simulated loans are included automatically.' },
    { key: 'savings', label: 'Monthly savings', unit: 'money' },
  ] },
  { id: 'balance', name: 'Assets & goals', icon: Landmark, description: 'Record current balances and the savings goal you want to work towards.', fields: [
    { key: 'assets', label: 'Assets', unit: 'money' },
    { key: 'liabilities', label: 'Other liabilities', unit: 'money' },
    { key: 'debt', label: 'Outstanding debt', unit: 'money', hint: 'Enter debt outside CredWise. The loan ledger supplies your platform balance.' },
    { key: 'reserves', label: 'Emergency savings', unit: 'money' },
    { key: 'goal', label: 'Financial goal', unit: 'text', hint: 'For example, setting aside three months of essential expenses.' },
    { key: 'goal_amount', label: 'Goal amount', unit: 'money' },
  ] },
  { id: 'evidence', name: 'Credit evidence', icon: ClipboardCheck, description: 'Use synthetic records. You can choose whether rent and utility history can inform an alternative assessment.', fields: [
    { key: 'credit_months', label: 'Credit history length', unit: 'months' },
    { key: 'utilization', label: 'Credit utilisation', unit: 'percent' },
    { key: 'on_time', label: 'On-time repayments', unit: 'count' },
    { key: 'missed', label: 'Missed repayments', unit: 'count' },
    { key: 'rent', label: 'Rent payments made on time', unit: 'percent', hint: 'Leave blank when no record is available.' },
    { key: 'utilities', label: 'Utility bills paid on time', unit: 'percent', hint: 'Leave blank when no record is available.' },
    { key: 'savings_reported', label: 'Include my declared monthly savings', unit: 'consent', hint: 'Clear to withdraw this amount as scoring evidence.' },
    { key: 'emi_reported', label: 'Include my declared instalments', unit: 'consent', hint: 'A reported zero records that you currently have no monthly instalments.' },
    { key: 'consent', label: 'Use my synthetic alternative evidence', unit: 'consent', hint: 'Allow rent and utility history to contribute to alternative credit assessment.' },
  ] },
];

function readableRatio(value: number | null, suffix = '%') {
  return value == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value) + suffix;
}

function monetaryInput(paise: number) {
  return (paise / 100).toFixed(2).replace(/\.00$/, '');
}

function parsePaise(text: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw Error('Use a non-negative rupee amount with up to two decimal places.');
  const [rupees, fraction = ''] = text.split('.');
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise > 100_000_000_000) throw Error('Amounts must be ₹1,00,00,00,000 or less.');
  return paise;
}

function Feedback({ message }: { message: string }) {
  return message ? <p className="identity-feedback" role="status"><Check size={16} aria-hidden="true"/>{message}</p> : null;
}

function CashFlow({ profile, metrics }: Pick<ProfileResult,'profile'|'metrics'>) {
  const allocations = [
    { label: 'Essentials', value: profile.essential, tone: 'essential' },
    { label: 'Optional spending', value: profile.discretionary, tone: 'optional' },
    { label: 'Instalments', value: profile.existing_emi, tone: 'instalment' },
    { label: 'Savings', value: profile.savings, tone: 'saving' },
  ];
  return <section className="identity-panel identity-cash" aria-labelledby="cash-heading">
    <div className="identity-panel-title"><div><span className="identity-overline">Monthly picture</span><h2 id="cash-heading">Cash flow</h2></div><span className="identity-symbol"><ArrowDownLeft size={22}/></span></div>
    <div className="identity-cash-income"><span>Income</span><strong>{money(metrics.income)}</strong></div>
    <div className="identity-stack" aria-hidden="true">{allocations.filter(item => item.value > 0).map(item =>
      <i className={'flow-' + item.tone} key={item.tone} style={{ flexGrow: item.value }}/>)}</div>
    <dl className="identity-ledger">{allocations.map(item => <div key={item.tone}><dt><i className={'flow-' + item.tone}/>{item.label}</dt><dd>{money(item.value)}</dd></div>)}</dl>
    <div className="identity-cash-balance"><span>Disposable income</span><strong>{money(metrics.disposable)}</strong></div>
  </section>;
}

const optionalEvidence = new Set<keyof Profile>(['rent','utilities','income_regularity']);

function ProfileEditor({ profile, section, onSaved }: { profile: Profile; section: ProfileSection; onSaved: (result: ProfileResult) => void }) {
  type Values = Record<string, string | boolean>;
  const defaults = Object.fromEntries(section.fields.map(field => [field.key,
    field.unit === 'money' ? monetaryInput(profile[field.key] as number)
      : field.unit === 'consent' ? Boolean(profile[field.key]) : String(profile[field.key] ?? '')])) as Values;
  const form = useForm<Values>({ defaultValues: defaults });
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (!form.formState.isDirty) form.reset(defaults); }, [profile]);
  const update = useMutation({
    mutationFn: async (values: Values) => {
      const patch: Record<string, number | string | boolean | null> = {};
      for (const field of section.fields) {
        const state = form.getFieldState(field.key, form.formState);
        if (!state.isDirty && !state.isTouched) continue;
        const input = String(values[field.key] ?? '').trim();
        if (field.unit === 'money') patch[field.key] = parsePaise(input);
        else if (field.unit === 'text') patch[field.key] = input;
        else if (field.unit === 'consent') patch[field.key] = Boolean(values[field.key]);
        else patch[field.key] = optionalEvidence.has(field.key) && input === '' ? null : Number(input);
      }
      if (!Object.keys(patch).length) throw Error('Edit a field before saving.');
      return api<ProfileResult>('profile', patch, 'PUT');
    },
    onSuccess(result, values) {
      onSaved(result);
      form.reset(values);
      setFeedback(section.name + ' saved.');
    },
  });
  const Icon = section.icon;
  return <form className="identity-panel identity-edit" onChange={() => setFeedback('')}
    onSubmit={form.handleSubmit(values => { setFeedback(''); update.mutate(values); })}>
    <div className="identity-panel-title"><div><h2>{section.name}</h2><p>{section.description}</p></div><span className="identity-symbol"><Icon size={21}/></span></div>
    <div className="identity-fields">{section.fields.map(field => {
      const id = 'profile-' + field.key;
      const hintId = field.hint ? id + '-help' : undefined;
      if (field.unit === 'consent') return <label className="identity-check identity-wide" key={id}>
        <input type="checkbox" {...form.register(field.key)}/><span><strong>{field.label}</strong><small>{field.hint}</small></span></label>;
      const numeric = field.unit !== 'text';
      const maximum = field.unit === 'months' ? 1200 : field.unit === 'count' ? 12000 : field.unit === 'percent' ? 100 : 1000000000;
      const suffix = field.unit === 'percent' ? '%' : field.unit === 'months' ? 'months' : '';
      return <div className="identity-field" key={id}><label htmlFor={id}>{field.label}</label>
        <div className="identity-control">{field.unit === 'money' && <span aria-hidden="true">₹</span>}
          <input id={id} type={numeric ? 'number' : 'text'} inputMode={field.unit === 'money' ? 'decimal' : numeric ? 'numeric' : 'text'}
            aria-describedby={hintId} required={field.key !== 'goal' && !optionalEvidence.has(field.key)} min={numeric ? 0 : undefined} max={numeric ? maximum : undefined}
            step={field.unit === 'money' ? '0.01' : numeric ? 1 : undefined}
            maxLength={field.unit === 'text' ? field.key === 'goal' ? 240 : 80 : undefined} {...form.register(field.key)}/>
          {suffix && <span aria-hidden="true">{suffix}</span>}</div>
        {field.hint && <small id={hintId}>{field.hint}</small>}
      </div>;
    })}</div>
    {update.error && <Failure message={errText(update.error)}/>}
    <div className="identity-actions"><Button type="submit" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}<Check size={16}/></Button>
      {form.formState.isDirty && <Button variant="ghost" type="button" onClick={() => { form.reset(defaults); update.reset(); setFeedback('Changes discarded.'); }}>Discard edits</Button>}
      <Feedback message={feedback}/></div>
  </form>;
}

export function ProfilePage() {
  const query = useResource<ProfileResult>('profile');
  const cache = useQueryClient();
  const [active, setActive] = useState('income');
  if (query.isPending) return <Loading/>;
  if (query.error) return <Failure message={errText(query.error)} retry={() => query.refetch()}/>;
  const { profile, metrics } = query.data;
  function saved(result: ProfileResult) {
    cache.setQueryData(['api', 'profile'], result);
    void cache.invalidateQueries({ queryKey: ['api'], predicate: item => item.queryKey[1] !== 'profile' });
  }
  return <div className="identity-page"><PageHeading kicker="Your workspace" title="Financial profile" description="Keep your income, commitments and savings up to date. Your assessments use these figures."/>
    <div className="identity-metrics"><Metric label="Monthly income" value={money(metrics.income)} detail="All income sources"/>
      <Metric label="Disposable income" value={money(metrics.disposable)} detail="Per month"/>
      <Metric label="Net worth" value={money(metrics.net_worth)} detail="Across your recorded balances"/>
      <Metric label="Financial health" value={metrics.health == null ? '—' : readableRatio(metrics.health, ' / 100')} detail="Simulated index"/></div>
    <div className="identity-profile-layout"><div className="identity-editor-column">
      <div className="identity-sections" role="group" aria-label="Profile sections">{sections.map(item => <button key={item.id}
        aria-pressed={item.id === active} onClick={() => setActive(item.id)}>{item.name}</button>)}</div>
      {sections.map(section => <div key={section.id} hidden={section.id !== active}>
        <ProfileEditor section={section} profile={profile} onSaved={saved}/>
      </div>)}
    </div><aside className="identity-aside"><CashFlow profile={query.data.effective_profile} metrics={metrics}/>{query.data.portfolio.debt>0&&<section className="identity-panel"><h2>CredWise loan commitments</h2><p>Your indicators include {money(query.data.portfolio.debt)} outstanding and {money(query.data.portfolio.existing_emi)} in monthly instalments from your simulated loans.</p></section>}
      <section className="identity-panel identity-ratios"><h2>Financial indicators</h2><dl className="identity-ledger">
        <div><dt>Savings rate</dt><dd>{readableRatio(metrics.savings_rate)}</dd></div>
        <div><dt>Debt-to-income ratio</dt><dd>{readableRatio(metrics.dti)}</dd></div>
        <div><dt>Instalments to income</dt><dd>{readableRatio(metrics.emi_ratio)}</dd></div>
        <div><dt>Emergency coverage</dt><dd>{readableRatio(metrics.coverage, ' months')}</dd></div>
      </dl>{[metrics.savings_rate, metrics.dti, metrics.emi_ratio, metrics.coverage].some(value => value == null) && <small>Add income and essential expenses to calculate ratios with a missing baseline.</small>}</section>
    </aside></div>
  </div>;
}

type DocumentMeta = { id: number; name: string; mime: string; size: number; sha256: string };
type KycRecord = {
  id: number; user_id: number; legal_name: string; address: string; employment: string;
  pan: string; status: 'pending' | 'verified' | 'rejected'; reason: string;
  document: DocumentMeta; created_at: string; updated_at: string; name?: string; email?: string;
};
type KycResult = { kyc: KycRecord | null };
const kycSchema = z.object({
  legal_name: z.string().trim().min(2, 'Enter the full name on your synthetic document.').max(100),
  address: z.string().trim().min(5, 'Enter a fictional address with at least five characters.').max(240),
  employment: z.string().trim().min(2, 'Enter a work or study status.').max(80),
  pan: z.string().trim().regex(/^DEMO[A-Z][0-9]{4}[A-Z]$/, 'Use DEMO, one letter, four digits and one final letter.'),
});
type KycValues = z.infer<typeof kycSchema>;

function makeFixture() {
  const seed = crypto.getRandomValues(new Uint32Array(3));
  const letter = (n: number) => String.fromCharCode(65 + n % 26);
  const values: KycValues = {
    legal_name: 'Mira Sen', address: 'Flat 12, Sample Lane, Demo Nagar',
    employment: 'Salaried', pan: 'DEMO' + letter(seed[0]) + String(seed[1] % 10000).padStart(4, '0') + letter(seed[2]),
  };
  const document: SyntheticDocument = {
    name: 'synthetic-verification.txt', mime: 'text/plain',
    content_base64: btoa(['CREDWISE-SYNTHETIC', 'Fictional identity and employment record',
      values.legal_name, values.address, values.employment, values.pan].join('\n')),
  };
  return { values, document };
}

function ReviewStatus({ value }: { value: string }) {
  const labels: Record<string, string> = { pending: 'Awaiting review', rejected: 'Changes needed', verified: 'Verified', active: 'Active', inactive: 'Inactive' };
  return <span className={'identity-status status-' + value}><i aria-hidden="true"/>{labels[value] ?? human(value || 'not started')}</span>;
}

function DocumentDownload({ path, filename }: { path: string; filename: string }) {
  const download = useMutation({
    mutationFn: () => api<SyntheticDocument>(path),
    onSuccess(file) {
      saveSynthetic(file);
    },
  });
  return <div><Button type="button" variant="outline" size="small" onClick={() => download.mutate()} disabled={download.isPending}>
    <Download size={15}/>{download.isPending ? 'Preparing…' : 'Download document'}</Button>
    <small className="identity-filename">{filename}</small>
    {download.error && <Failure message={errText(download.error)}/>}</div>;
}

function KycForm({ record, saved }: { record: KycRecord | null; saved: (result: KycResult) => void }) {
  const form = useForm<KycValues>({ resolver: zodResolver(kycSchema), defaultValues: {
    legal_name: record?.legal_name ?? '', address: record?.address ?? '',
    employment: record?.employment ?? '', pan: record?.pan ?? '',
  } });
  const [file, setFile] = useState<SyntheticDocument | null>(null);
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [fileInput, setFileInput] = useState(0);
  const submit = useMutation({ mutationFn: (values: KycValues) => api<KycResult>('kyc', { ...values, document: file }), onSuccess: saved });
  const textFields: { key: keyof KycValues; label: string; placeholder: string }[] = [
    { key: 'legal_name', label: 'Synthetic full name', placeholder: 'Mira Sen' },
    { key: 'employment', label: 'Employment or study status', placeholder: 'Salaried, student, freelance…' },
    { key: 'address', label: 'Fictional address', placeholder: 'Flat 12, Sample Lane, Demo Nagar' },
    { key: 'pan', label: 'Synthetic PAN', placeholder: 'DEMOX1234Q' },
  ];
  function useExample() {
    const fixture = makeFixture();
    form.reset(fixture.values); setFile(fixture.document); setFileError(''); setFileInput(v => v + 1);
  }
  return <form className="identity-panel identity-edit" onSubmit={form.handleSubmit(values => {
    if (!file) { setFileError('Choose a synthetic document or fill in the example.'); return; }
    setFileError(''); submit.mutate(values);
  })}>
    <div className="identity-panel-title"><div><h2>{record ? 'Update your submission' : 'Identity and work details'}</h2>
      <p>Use invented details and a synthetic document for this demonstration.</p></div><span className="identity-symbol"><Fingerprint size={22}/></span></div>
    <div className="identity-fixture"><div><strong>Use a ready-made example</strong><small>Fills the details and attaches a fictional verification record.</small></div>
      <Button type="button" variant="outline" size="small" onClick={useExample} disabled={reading || submit.isPending}>Fill example</Button></div>
    <div className="identity-fields">{textFields.map(field => <div key={field.key} className="identity-field">
      <label htmlFor={'kyc-' + field.key}>{field.label}</label>
      <div className="identity-control"><input id={'kyc-' + field.key} placeholder={field.placeholder} autoComplete="off"
        maxLength={field.key === 'pan' ? 10 : field.key === 'address' ? 240 : field.key === 'employment' ? 80 : 100}
        aria-invalid={Boolean(form.formState.errors[field.key])} aria-describedby={form.formState.errors[field.key] ? 'error-' + field.key : undefined}
        {...form.register(field.key, field.key === 'pan' ? { onChange: event => form.setValue('pan', event.target.value.toUpperCase()) } : {})}/></div>
      {form.formState.errors[field.key] && <small className="identity-error" id={'error-' + field.key}>{form.formState.errors[field.key]?.message}</small>}
    </div>)}</div>
    <div className="identity-upload"><div><Upload size={19}/><label htmlFor="kyc-document">Synthetic document</label></div>
      <small id="kyc-document-help">Use a UTF-8 .txt beginning with CREDWISE-SYNTHETIC, or a .pdf containing that marker. Maximum 256 KB.</small>
      <input id="kyc-document" key={fileInput} type="file" accept=".txt,.pdf" disabled={reading || submit.isPending}
        aria-describedby="kyc-document-help" onChange={async event => {
          const candidate = event.currentTarget.files?.[0];
          if (!candidate) return;
          setReading(true); setFile(null); setFileError('');
          try { setFile(await readSynthetic(candidate)); } catch (error) { setFileError(errText(error)); }
          finally { setReading(false); }
        }}/>
      {file && <p className="identity-file-selected"><FileText size={16}/>{file.name} is attached</p>}
      {fileError && <p className="identity-error" role="alert">{fileError}</p>}</div>
    {submit.error && <Failure message={errText(submit.error)}/>}
    <div className="identity-actions"><Button type="submit" disabled={reading || submit.isPending}>{submit.isPending ? 'Submitting…' : record ? 'Resubmit for review' : 'Submit for review'}<ArrowRight size={16}/></Button></div>
  </form>;
}

export function KycPage() {
  const query = useResource<KycResult>('kyc');
  const cache = useQueryClient();
  const [notice, setNotice] = useState('');
  if (query.isPending) return <Loading/>;
  if (query.error) return <Failure message={errText(query.error)} retry={() => query.refetch()}/>;
  const record = query.data.kyc;
  return <div className="identity-page"><PageHeading kicker="Customer verification" title="Identity verification" description="Submit synthetic identity and employment evidence, then track your administrator’s review."/>
    <Feedback message={notice}/>
    {record && <section className="identity-panel identity-kyc-status"><div className="identity-panel-title"><div><span className="identity-overline">Your submission</span><h2>{record.legal_name}</h2></div><ReviewStatus value={record.status}/></div>
      <dl className="identity-details"><div><dt>Synthetic PAN</dt><dd>{record.pan}</dd></div><div><dt>Employment</dt><dd>{record.employment}</dd></div>
        <div><dt>Address</dt><dd>{record.address}</dd></div><div><dt>Last updated</dt><dd>{date(record.updated_at)}</dd></div></dl>
      {record.reason && <div className="identity-reason"><strong>Reviewer’s note</strong><p>{record.reason}</p></div>}
      <DocumentDownload path="kyc/document" filename={record.document.name}/>
    </section>}
    {(!record || record.status === 'rejected') && <KycForm record={record} saved={result => {
      cache.setQueryData(['api', 'kyc'], result); void cache.invalidateQueries({ queryKey: ['api'], predicate: item => item.queryKey[1] !== 'kyc' });
      setNotice('Your synthetic record was submitted for review.');
    }}/>}
  </div>;
}

type Preferences = {
  theme: 'system' | 'light' | 'dark'; language: 'en' | 'hi';
  notifications: { applications: boolean; payments: boolean; learning: boolean; distress: boolean };
};
type UserRow = { id: number; name: string; email: string; active: boolean; role: string; created_at: string; kyc_status?: string };
type Settings = { user: UserRow; preferences: Preferences };
const notificationFields: { key: keyof Preferences['notifications']; title: string; detail: string }[] = [
  { key: 'applications', title: 'Application updates', detail: 'Decisions, missing documents and changes in status.' },
  { key: 'payments', title: 'Payments and reminders', detail: 'Instalment reminders, receipts and loan closure.' },
  { key: 'learning', title: 'Learning and milestones', detail: 'Academy updates and progress on learning goals.' },
  { key: 'distress', title: 'Financial wellbeing', detail: 'Changes in your cash flow and repayment burden.' },
];

function SettingsForm({ data, saved }: { data: Settings; saved: (result: Settings) => void }) {
  const [name, setName] = useState(data.user.name);
  const [preferences, setPreferences] = useState(data.preferences);
  const [notice, setNotice] = useState('');
  const change = useMutation({
    mutationFn: () => api<Settings>('settings', { name: name.trim(), preferences }, 'PUT'),
    onSuccess(result) {
      saved(result); setPreferences(result.preferences); setName(result.user.name);
      const choice = result.preferences.theme;
      const theme = choice === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' : choice;
      localStorage.setItem('cw-theme', theme); document.documentElement.dataset.theme = theme;
      window.dispatchEvent(new CustomEvent('cw-preferences', { detail: result.preferences }));
      setNotice('Preferences saved.');
    },
  });
  return <form className="identity-panel identity-edit" onChange={() => setNotice('')} onSubmit={event => { event.preventDefault(); change.mutate(); }}>
    <div className="identity-panel-title"><div><h2>Account preferences</h2><p>Choose how the workspace looks and which in-app updates you receive.</p></div><span className="identity-symbol"><BadgeCheck size={21}/></span></div>
    <div className="identity-fields">
      <label className="identity-field">Display name<span className="identity-control"><input value={name} minLength={2} maxLength={100} required onChange={event => setName(event.target.value)} autoComplete="name"/></span></label>
      <label className="identity-field">Account email<span className="identity-control"><input value={data.user.email} readOnly type="email" autoComplete="email"/></span></label>
      <label className="identity-field">Appearance<select value={preferences.theme} onChange={event => setPreferences({ ...preferences, theme: event.target.value as Preferences['theme'] })}>
        <option value="system">Device setting</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      <label className="identity-field">Academy language<select value={preferences.language} onChange={event => setPreferences({ ...preferences, language: event.target.value as Preferences['language'] })}>
        <option value="en">English</option><option value="hi" lang="hi">हिन्दी</option></select></label>
    </div>
    <fieldset className="identity-notifications"><legend>In-app notifications</legend>{notificationFields.map(option =>
      <label className="identity-check" key={option.key}><input type="checkbox" checked={preferences.notifications[option.key]}
        onChange={event => setPreferences({ ...preferences, notifications: { ...preferences.notifications, [option.key]: event.target.checked } })}/>
        <span><strong>{option.title}</strong><small>{option.detail}</small></span></label>)}</fieldset>
    {change.error && <Failure message={errText(change.error)}/>}
    <div className="identity-actions"><Button type="submit" disabled={!name.trim() || change.isPending}>{change.isPending ? 'Saving…' : 'Save preferences'}<Check size={16}/></Button><Feedback message={notice}/></div>
  </form>;
}

function SecurityForms({ customer }: { customer: boolean }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deactivationPassword, setDeactivationPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [validation, setValidation] = useState('');
  const update = useMutation({
    mutationFn: () => api<Settings>('settings', { current_password: current, new_password: password }, 'PUT'),
    onSuccess() { setCurrent(''); setPassword(''); setConfirmation(''); setNotice('Password updated.'); },
  });
  const deactivate = useMutation({
    mutationFn: () => api<Settings>('settings', { active: false, current_password: deactivationPassword }, 'PUT'),
    onSuccess() { window.location.assign('/login'); },
  });
  return <><form className="identity-panel identity-edit" onChange={() => { setNotice(''); setValidation(''); }} onSubmit={event => {
    event.preventDefault();
    if (password !== confirmation) { setValidation('The new passwords do not match.'); return; }
    setValidation(''); update.mutate();
  }}>
    <div className="identity-panel-title"><div><h2>Change password</h2><p>Confirm your current password before setting a new one.</p></div><span className="identity-symbol"><LockKeyhole size={20}/></span></div>
    <div className="identity-fields">
      <label className="identity-field identity-wide">Current password<span className="identity-control"><input type="password" autoComplete="current-password" required
        value={current} onChange={event => setCurrent(event.target.value)}/></span></label>
      <label className="identity-field">New password<span className="identity-control"><input type="password" autoComplete="new-password" minLength={12} maxLength={128} required
        value={password} onChange={event => setPassword(event.target.value)}/></span></label>
      <label className="identity-field">Confirm new password<span className="identity-control"><input type="password" autoComplete="new-password" maxLength={128} required
        value={confirmation} onChange={event => setConfirmation(event.target.value)}/></span></label>
    </div>{validation && <Failure message={validation}/>} {update.error && <Failure message={errText(update.error)}/>}
    <div className="identity-actions"><Button type="submit" variant="outline" disabled={update.isPending}>{update.isPending ? 'Updating…' : 'Update password'}</Button><Feedback message={notice}/></div>
  </form>
    {customer && <details className="identity-panel identity-deactivate"><summary>Deactivate my account</summary><p>Deactivation ends your sessions. An administrator can restore your account.</p>
      <form onSubmit={event => { event.preventDefault(); deactivate.mutate(); }}>
        <label className="identity-field">Confirm your password for deactivation<span className="identity-control"><input type="password" value={deactivationPassword} required
          autoComplete="current-password" onChange={event => setDeactivationPassword(event.target.value)}/></span></label>
        {deactivate.error && <Failure message={errText(deactivate.error)}/>}
        <Button type="submit" variant="outline" className="identity-destructive" disabled={deactivate.isPending}>{deactivate.isPending ? 'Deactivating…' : 'Deactivate account'}</Button>
      </form></details>}
  </>;
}

export function SettingsPage() {
  const query = useResource<Settings>('settings');
  const cache = useQueryClient();
  if (query.isPending) return <Loading/>;
  if (query.error) return <Failure message={errText(query.error)} retry={() => query.refetch()}/>;
  return <div className="identity-page"><PageHeading kicker="Your account" title="Settings & security" description="Manage your profile name, learning preferences, notifications and account access."/>
    <SettingsForm data={query.data} saved={result => {
      cache.setQueryData(['api', 'settings'], result); void cache.invalidateQueries({ queryKey: ['api'], predicate: item => item.queryKey[1] !== 'settings' });
    }}/><SecurityForms customer={query.data.user.role === 'customer'}/></div>;
}

function KycReview({ record, onReviewed }: { record: KycRecord; onReviewed: (status: string) => void }) {
  const prefix = useId();
  const [decision, setDecision] = useState<'verified' | 'rejected'>('verified');
  const [reason, setReason] = useState('');
  const review = useMutation({
    mutationFn: () => api<KycResult>('admin/kyc/' + record.user_id, { status: decision, reason: reason.trim() }),
    onSuccess() { onReviewed(decision); },
  });
  return <section className="identity-panel identity-review"><div className="identity-panel-title"><div><span className="identity-overline">Verification record</span><h2>{record.legal_name}</h2><p>{record.email}</p></div><ReviewStatus value={record.status}/></div>
    <dl className="identity-details"><div><dt>Account name</dt><dd>{record.name}</dd></div><div><dt>Last updated</dt><dd>{date(record.updated_at)}</dd></div>
      <div><dt>Synthetic PAN</dt><dd>{record.pan}</dd></div><div><dt>Employment</dt><dd>{record.employment}</dd></div><div><dt>Address</dt><dd>{record.address}</dd></div></dl>
    <DocumentDownload path={'admin/kyc/' + record.user_id + '/document'} filename={record.document.name}/>
    {record.reason && <div className="identity-reason"><strong>Review note</strong><p>{record.reason}</p></div>}
    {record.status === 'pending' && <form className="identity-decision" onSubmit={event => { event.preventDefault(); review.mutate(); }}>
      <h3>Review decision</h3>
      <div className="identity-fields"><div className="identity-field"><label htmlFor={prefix + '-decision'}>Decision</label>
        <select id={prefix + '-decision'} value={decision} onChange={event => setDecision(event.target.value as typeof decision)}>
          <option value="verified">Verify submission</option><option value="rejected">Request corrections</option></select></div>
        <div className="identity-field identity-wide"><label htmlFor={prefix + '-reason'}>Review note{decision === 'rejected' ? ' (required)' : ' (optional)'}</label>
          <textarea id={prefix + '-reason'} placeholder={decision === 'rejected' ? 'Explain what the customer needs to correct.' : 'Record the evidence you reviewed.'}
            rows={3} value={reason} required={decision === 'rejected'} maxLength={500} onChange={event => setReason(event.target.value)}/></div>
      </div>{review.error && <Failure message={errText(review.error)}/>}
      <Button type="submit" disabled={review.isPending || (decision === 'rejected' && !reason.trim())}>{review.isPending ? 'Recording…' : 'Record decision'}<Check size={16}/></Button></form>}
  </section>;
}

function AdminKyc() {
  const [status, setStatus] = useState('pending');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const cache = useQueryClient();
  const query = useResource<{ items: KycRecord[]; total: number }>('admin/kyc' + (status ? '?status=' + status : ''));
  const selected = query.data?.items.find(item => item.user_id === selectedId);
  return <div className="identity-page"><PageHeading kicker="Operations" title="Verification queue" description="Review submitted synthetic documents and give customers a clear decision."/>
    <div className="identity-toolbar"><label className="identity-field">Review status<select value={status} onChange={event => { setStatus(event.target.value); setSelectedId(null); }}>
      <option value="pending">Awaiting review</option><option value="verified">Verified</option><option value="rejected">Changes needed</option><option value="">All submissions</option></select></label>
      {query.data && <span>{query.data.total} {query.data.total === 1 ? 'submission' : 'submissions'}</span>}</div>
    <Feedback message={notice}/>
    {query.isPending ? <Loading/> : query.error ? <Failure message={errText(query.error)} retry={() => query.refetch()}/> : query.data.items.length === 0 ?
      <Empty title="No submissions here">Customer verification records will appear when they match this filter.</Empty> :
      <div className="identity-admin-layout"><div className="identity-queue" aria-label="Verification submissions">{query.data.items.map(item =>
        <button key={item.user_id} aria-pressed={item.user_id === selectedId} className="identity-queue-item" onClick={() => { setSelectedId(item.user_id); setNotice(''); }}>
          <span><strong>{item.legal_name}</strong><small>{item.email}</small><ReviewStatus value={item.status}/></span><ChevronRight size={18}/></button>
      )}</div>{selected ? <KycReview key={selected.id + '-' + selected.updated_at} record={selected} onReviewed={decision => {
        setSelectedId(null); setNotice(decision === 'verified' ? 'Submission verified.' : 'Correction request recorded.');
        void cache.invalidateQueries({ queryKey: ['api'] });
      }}/> : <section className="identity-panel identity-select-prompt"><ShieldCheck size={32}/><h2>Select a submission</h2><p>Open a record to inspect the details and its synthetic document.</p></section>}</div>}
  </div>;
}

function AdminUsers() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState('');
  const pageSize = 12;
  const cache = useQueryClient();
  const query = useResource<{ items: UserRow[]; total: number; page: number }>('admin/users?q=' + encodeURIComponent(search) + '&page=' + page + '&page_size=' + pageSize);
  const own = useResource<Settings>('settings');
  const change = useMutation({
    mutationFn: (user: UserRow) => api<{ user: UserRow }>('admin/users/' + user.id, { active: !user.active }),
    onSuccess(result) {
      setNotice(result.user.name + (result.user.active ? ' was reactivated.' : ' was deactivated.'));
      setSelected(null); void cache.invalidateQueries({ queryKey: ['api'] });
    },
  });
  function applySearch(value: string) { setSearch(value.trim()); setPage(1); setSelected(null); setNotice(''); }
  return <div className="identity-page"><PageHeading kicker="Operations" title="Customer management" description="Find customer accounts, review their verification status and manage access."/>
    <form className="identity-toolbar identity-search" onSubmit={event => { event.preventDefault(); applySearch(input); }}>
      <div className="identity-field"><label htmlFor="account-search">Search accounts</label>
        <div className="identity-control"><Search size={17}/><input id="account-search" type="search" placeholder="Search by name or email" value={input} onChange={event => setInput(event.target.value)}/></div></div>
      <Button type="submit" variant="outline">Search</Button>{search && <Button variant="ghost" type="button" onClick={() => { setInput(''); applySearch(''); }}>Clear</Button>}
    </form><Feedback message={notice}/>
    {query.isPending ? <Loading/> : query.error ? <Failure message={errText(query.error)} retry={() => query.refetch()}/> : query.data.items.length === 0 ?
      <Empty title="No matching accounts">Try a different name or email address.</Empty> : <section className="identity-panel identity-directory">
        <div className="identity-panel-title"><div><span className="identity-overline">Account directory</span><h2>{query.data.total} {query.data.total === 1 ? 'account' : 'accounts'}</h2></div></div>
        <div className="identity-table-scroll"><table><thead><tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Verification</th><th scope="col">Access</th><th scope="col">Action</th></tr></thead>
          <tbody>{query.data.items.map(user => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{human(user.role)}</td>
            <td>{human(user.kyc_status || 'not started')}</td><td><ReviewStatus value={user.active ? 'active' : 'inactive'}/></td><td>
              {own.data?.user.id === user.id ? <small>Your account</small> : <Button type="button" variant="outline" size="small" onClick={() => { change.reset(); setSelected(user); setNotice(''); }}>
                {user.active ? 'Deactivate' : 'Reactivate'}</Button>}</td></tr>)}</tbody></table></div>
        <div className="identity-pagination"><span>Page {page} of {Math.max(1, Math.ceil(query.data.total / pageSize))}</span>
          <Button variant="outline" size="small" type="button" disabled={page === 1} onClick={() => { setPage(page - 1); setSelected(null); }}><ChevronLeft size={15}/>Previous</Button>
          <Button variant="outline" size="small" type="button" disabled={page * pageSize >= query.data.total} onClick={() => { setPage(page + 1); setSelected(null); }}>Next<ChevronRight size={15}/></Button></div>
      </section>}
    {selected && <section className="identity-panel identity-confirm"><h2>{selected.active ? 'Deactivate ' : 'Reactivate '}{selected.name}?</h2><p>{selected.email}</p>
      <p>{selected.active ? 'Their current sessions will end and sign-in will be disabled.' : 'They will be able to sign in again with their existing credentials.'}</p>
      {change.error && <Failure message={errText(change.error)}/>}
      <div className="identity-actions"><Button disabled={change.isPending} type="button" onClick={() => change.mutate(selected)}>{change.isPending ? 'Updating…' : selected.active ? 'Confirm deactivation' : 'Confirm reactivation'}</Button>
        <Button variant="ghost" type="button" disabled={change.isPending} onClick={() => setSelected(null)}>Cancel</Button></div>
    </section>}
  </div>;
}

export function AdminIdentityPage({ kind }: { kind: 'kyc' | 'users' }) {
  return kind === 'kyc' ? <AdminKyc/> : <AdminUsers/>;
}
