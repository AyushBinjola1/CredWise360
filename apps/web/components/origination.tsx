'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, BadgeCheck, Check, ChevronLeft, ChevronRight, ClipboardCheck,
  Clock3, FileCheck2, FileText, GitBranch, ListChecks, Plus, RotateCw, Search, ShieldCheck, Upload, Wallet } from 'lucide-react';
import { api, date, errText, human, money, useResource } from '@/lib/api';
import type { ProfileResult } from '@/lib/model';
import { readSynthetic, saveSynthetic, type SyntheticDocument } from '@/lib/synthetic-document';
import { Button } from './ui/button';
import { Empty, Failure, Loading, Metric, PageHeading } from './states';
import { PdfButton } from './pdf-button';
import './origination.css';

type Stage = 'draft'|'submitted'|'under_review'|'requires_information'|'approved'|'rejected'|'accepted'|'disbursed'|'active'|'closed'|'defaulted'|'withdrawn';
type Product = { slug: string; name: string; description: string; min_amount: number; max_amount: number; min_months: number; max_months: number; rate_bps: number; fee_bps: number; documents: string[] };
type Application = {
  id: number; user_id: number; product_slug: string; principal: number; months: number; purpose: string;
  status: Stage; tracking_id: string | null; preview_token: string | null; loan_id: number | null; revision: number;
  created_at: string; updated_at: string; escalated: boolean; product_name?: string; applicant_name?: string;
};
type DocumentMeta = { id: number; kind: string; name: string; mime: string; size: number };
type Activity = { id: number; status: Stage; action: string; note: string; actor_name: string; created_at: string };
type Credit = { score: number | null; risk: string; human_review: boolean; capacity: number; reasons: string[]; reason_codes: string[]; factors: { name: string; reason: string; weight: number; value: number | null }[] };
type Quote = {
  emi: number; total_interest: number; total_repayment: number; total_cost: number; principal: number; fee: number; net_proceeds: number; effective_rate: number | null;
  schedule: { month: number; payment: number; interest: number; principal: number; balance: number }[];
};
type Assessment = { product: Product; quote: Quote; eligible: boolean; human_review: boolean; reasons: string[]; warnings: string[]; compatibility: number; kyc_status: string };
type Recovery = { reason_codes: string[]; reasons: string[]; milestones: { title: string; detail: string }[]; alternatives: { slug: string; name: string }[]; reassessment_eligible: boolean };
type ApplicationDetail = {
  application: Application; documents: DocumentMeta[]; timeline: Activity[]; required_documents: string[];
  assessment: Assessment | null; offer: { version: number; issued_at: string; product: Product; quote: Quote } | null;
  recovery: Recovery | null; kyc: { status: string; reason: string; updated_at: string } | null; profile: ProfileResult; credit: Credit;
  fraud_alerts: { id?: number; severity: string; rule?: string; evidence?: string; explanation?: string; status?: string }[];
};
type PageResult = { items: Application[]; total: number; page: number; page_size: number };
const stages: Stage[] = ['draft','submitted','under_review','requires_information','approved','rejected','accepted','disbursed','active','closed','defaulted','withdrawn'];
const stageLabels: Record<Stage,string> = { draft:'Draft',submitted:'Submitted',under_review:'Under review',requires_information:'Information requested',approved:'Approved',
  rejected:'Rejected',accepted:'Terms accepted',disbursed:'Disbursed',active:'Active loan',closed:'Closed',defaulted:'Defaulted',withdrawn:'Withdrawn' };
const steps = ['Funding request','Financial profile','Eligibility & cost','Documents','Confirm'];
const timestamp = new Intl.DateTimeFormat('en-IN', { day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata' });
function reference(app: Application) { return app.tracking_id || 'Draft #' + app.id; }
function StageBadge({ status }: { status: Stage }) { return <span className={'orig-badge stage-' + status}><i/>{stageLabels[status] ?? human(status)}</span>; }
function StatusMessage({ children }: { children: React.ReactNode }) { return children ? <p className="orig-feedback" role="status"><Check size={16}/>{children}</p> : null; }
function rupees(raw: string) {
  const value=/^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!value) throw Error('Use a positive rupee amount with up to two decimal places.');
  const paise=Number(value[1])*100+Number((value[2] ?? '').padEnd(2,'0'));
  if(!Number.isSafeInteger(paise)||paise<1||paise>100_000_000_000) throw Error('Enter an amount within the supported range.');
  return paise;
}
function useDetailAction(path: string) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ action, body, method = 'POST' }: { action?: string; body?: object; method?: 'PUT'|'POST' }) =>
      api<ApplicationDetail>(path + (action ? '/' + action : ''), body ?? {}, method),
    onSuccess(result) {
      cache.setQueryData(['api', path], result);
      void cache.invalidateQueries({ queryKey: ['api'], predicate: query => query.queryKey[1] !== path });
    },
  });
}

function ActivityTimeline({ events }: { events: Activity[] }) {
  return <section className="panel orig-panel"><div className="panelhead"><h2>Application activity</h2><Clock3 size={19}/></div>
    {events.length === 0 ? <Empty title="No activity yet"/> : <ol className="orig-timeline">{events.slice().reverse().map(event =>
      <li key={event.id}><div><strong>{human(event.action)}</strong><time dateTime={event.created_at}>{timestamp.format(new Date(event.created_at))} IST</time></div>
      <p>{event.note || stageLabels[event.status]}</p><small>{event.actor_name || 'System'} · {stageLabels[event.status]}</small></li>)}</ol>}</section>;
}

function FinancialEvidence({ data, admin = false }: { data: ApplicationDetail; admin?: boolean }) {
  const profile=data.profile, credit=data.credit, kyc=data.kyc;
  return <section className="panel orig-panel"><div className="panelhead"><h2>Financial evidence</h2><Wallet size={20}/></div>
    <dl className="orig-facts"><div><dt>Monthly income</dt><dd>{money(profile.metrics.income)}</dd></div>
      <div><dt>Monthly expenses</dt><dd>{money(profile.metrics.expenses)}</dd></div><div><dt>Existing instalments</dt><dd>{money(profile.profile.existing_emi)}</dd></div>
      <div><dt>Disposable income</dt><dd>{money(profile.metrics.disposable)}</dd></div><div><dt>Employment</dt><dd>{profile.profile.employment}</dd></div>
      <div><dt>Simulated credit score</dt><dd>{credit.score ?? 'More evidence needed'}</dd></div><div><dt>Risk assessment</dt><dd>{human(credit.risk)}</dd></div>
      <div><dt>Additional monthly EMI capacity</dt><dd>{money(credit.capacity)}</dd></div><div><dt>Simulated KYC</dt><dd>{human(kyc?.status ?? 'not_started')}</dd></div></dl>
    {kyc?.reason && <p className="orig-note">{kyc.reason}</p>}
    {admin ? <details className="orig-details"><summary>Credit factors and reasons</summary><ul className="prose-list">{credit.factors.map(f => <li key={f.name}><strong>{f.name}</strong> · {f.weight}% weight. {f.reason}</li>)}
      {!credit.factors.length && credit.reasons.map(r => <li key={r}>{r}</li>)}</ul></details> :
      <div className="buttonrow"><Link className="under" href="/app/profile">Edit financial profile</Link>
        {kyc?.status !== 'verified' && <Link className="under" href="/app/kyc">Open identity verification</Link>}</div>}</section>;
}

function OfferNumbers({ quote }: { quote: Quote }) {
  const [schedule, setSchedule] = useState(false), [page, setPage] = useState(0);
  const pages=Math.ceil(quote.schedule.length/12), index=Math.min(page,Math.max(0,pages-1));
  return <section className="panel orig-panel"><div className="panelhead"><h2>Repayment illustration</h2><ListChecks size={20}/></div>
    <div className="orig-offer-emi"><span>Estimated monthly instalment</span><strong>{money(quote.emi)}</strong></div>
    <dl className="orig-facts"><div><dt>Requested principal</dt><dd>{money(quote.principal)}</dd></div><div><dt>Processing fee</dt><dd>{money(quote.fee)}</dd></div>
      <div><dt>Net proceeds</dt><dd>{money(quote.net_proceeds)}</dd></div><div><dt>Total interest</dt><dd>{money(quote.total_interest)}</dd></div>
      <div><dt>Total instalments</dt><dd>{money(quote.total_repayment)}</dd></div><div><dt>Total including charges</dt><dd>{money(quote.total_cost)}</dd></div>
      <div><dt>Estimated effective annual cost</dt><dd>{quote.effective_rate == null ? 'Unavailable' : new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(quote.effective_rate)+'%'}</dd></div></dl>
    <details className="orig-details" onToggle={event => setSchedule(event.currentTarget.open)}><summary>Monthly amortization schedule</summary>
      {schedule && <><div className="tablewrap"><table className="datatable"><thead><tr>{['Month','Payment','Interest','Principal','Balance'].map(s=><th key={s} scope="col">{s}</th>)}</tr></thead>
        <tbody>{quote.schedule.slice(index*12,(index+1)*12).map(row=><tr key={row.month}><th scope="row">{row.month}</th>
          <td>{money(row.payment)}</td><td>{money(row.interest)}</td><td>{money(row.principal)}</td><td>{money(row.balance)}</td></tr>)}</tbody></table></div>
        {pages>1 && <div className="orig-pagination"><span>Page {index+1} of {pages}</span><Button type="button" variant="outline" size="small" disabled={!index} onClick={()=>setPage(index-1)}>Previous</Button>
          <Button type="button" size="small" variant="outline" disabled={index+1>=pages} onClick={()=>setPage(index+1)}>Next</Button></div>}</>}
    </details></section>;
}

function Eligibility({ value }: { value: Assessment }) {
  return <section className="panel orig-panel"><div className="panelhead"><h2>Eligibility assessment</h2><ShieldCheck size={20}/></div>
    <p className={'orig-assessment ' + (value.eligible ? 'positive' : 'caution')}>{value.eligible ? value.human_review ? 'Human review recommended' : 'Within the simulated criteria' : 'Outside the current criteria'}</p>
    <ul className="prose-list">{value.reasons.map(reason => <li key={reason}>{reason}</li>)}{value.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></section>;
}

function EvidenceList({ data, path, editable = false }: { data: ApplicationDetail; path: string; editable?: boolean }) {
  const change=useDetailAction(path), [message,setMessage]=useState(''), [localError,setLocalError]=useState(''), [busy,setBusy]=useState('');
  const download=useMutation({mutationFn:(id:number)=>api<SyntheticDocument>(path+'/documents/'+id),onSuccess:saveSynthetic});
  async function attach(kind:string,file?:File) {
    setLocalError('');setMessage('');setBusy(kind);
    try {
      let document:SyntheticDocument;
      if(file) document=await readSynthetic(file);
      else {
        const demo='CREDWISE-SYNTHETIC\n'+kind+'\nReference '+reference(data.application)+'\nSynthetic evidence for a fictional application.';
        const bytes=new TextEncoder().encode(demo);
        document={name:'demo-'+kind.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.txt',mime:'text/plain',content_base64:btoa(String.fromCharCode(...bytes))};
      }
      await change.mutateAsync({method:'PUT',body:{revision:data.application.revision,documents:[{kind,...document}]}});
      setMessage(kind+' attached.');
    } catch(error) {setLocalError(errText(error));} finally {setBusy('');}
  }
  return <section className="panel orig-panel"><div className="panelhead"><h2>Supporting documents</h2><FileCheck2 size={20}/></div>
    {editable && <p>Attach a marked synthetic text file or PDF up to 256 KB for each requirement. The example button creates a fictional record.</p>}
    <div className="orig-document-list">{data.required_documents.map(kind=>{
      const saved=data.documents.find(doc=>doc.kind===kind);
      return <div className="orig-document" key={kind}><div><FileText size={19}/><div><strong>{kind}</strong><small>{saved ? saved.name+' · '+Math.ceil(saved.size/1024)+' KB' : 'Awaiting document'}</small></div></div>
        <div className="buttonrow">{saved && <Button type="button" variant="outline" size="small" aria-label={'Download '+kind} disabled={download.isPending} onClick={()=>download.mutate(saved.id)}>Download</Button>}
          {editable && <><label className="orig-upload"><Upload size={14}/>{saved?'Replace file':'Upload file'}<input type="file" accept=".txt,.pdf" aria-label={'Upload '+kind} disabled={Boolean(busy)}
            onChange={event=>{const file=event.currentTarget.files?.[0];event.currentTarget.value='';if(file)void attach(kind,file);}}/></label>
            <Button type="button" variant="ghost" size="small" aria-label={'Use example for '+kind} disabled={Boolean(busy)} onClick={()=>void attach(kind)}>{busy===kind?'Attaching…':'Use example'}</Button></>}</div></div>;
    })}</div>{localError && <Failure message={localError}/>} {download.error && <Failure message={errText(download.error)}/>}<StatusMessage>{message}</StatusMessage></section>;
}

function RequestForm({ products, data, initialSlug, onSaved }: { products: Product[]; data?: ApplicationDetail; initialSlug?: string; onSaved: (result: ApplicationDetail) => void }) {
  const initial=products.find(p=>p.slug===(data?.application.product_slug || initialSlug)) ?? products[0];
  const [product,setProduct]=useState(initial.slug), [purpose,setPurpose]=useState(data?.application.purpose ?? ''),
    [amount,setAmount]=useState(data?.application.principal ? String(data.application.principal/100) : String(Math.max(initial.min_amount,Math.min(10_000_000,initial.max_amount))/100)),
    [months,setMonths]=useState(String(data?.application.months ?? Math.max(initial.min_months,Math.min(24,initial.max_months))));
  const chosen=products.find(p=>p.slug===product)!;
  const operation=useMutation({mutationFn:()=>{
    const body={product_slug:product,principal:rupees(amount),months:Number(months),purpose:purpose.trim(),...(data?{revision:data.application.revision}:{})};
    return api<ApplicationDetail>(data ? 'applications/'+data.application.id : 'applications',body,data?'PUT':'POST');
  },onSuccess:onSaved});
  return <form className="panel orig-panel formstack" onSubmit={event=>{event.preventDefault();operation.mutate();}}><div className="panelhead"><div><h2>Funding request</h2><p>Describe the expense and choose the amount you actually need.</p></div><ClipboardCheck size={21}/></div>
    <label>Loan product<select value={product} onChange={event=>setProduct(event.target.value)}>{products.map(p=><option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
    <div className="orig-product-summary"><strong>{chosen.name}</strong><p>{chosen.description}</p><small>{money(chosen.min_amount)}–{money(chosen.max_amount)} · {chosen.min_months}–{chosen.max_months} months · {chosen.rate_bps/100}% annual rate</small></div>
    <label>Loan purpose<textarea required minLength={2} maxLength={240} rows={2} value={purpose} placeholder="For example, a defined household repair" onChange={event=>setPurpose(event.target.value)}/></label>
    <div className="controlgrid"><label>Requested principal (₹)<input required type="number" min=".01" max={1000000000} step=".01" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)}/></label>
      <label>Requested term (months)<input type="number" min={1} max={600} step={1} required inputMode="numeric" value={months} onChange={event=>setMonths(event.target.value)}/></label></div>
    {operation.error && <Failure message={errText(operation.error)}/>}<div className="buttonrow"><Button type="submit" disabled={operation.isPending || !purpose.trim()}>{operation.isPending?'Saving…':'Save draft and continue'}<ArrowRight size={16}/></Button></div></form>;
}

function RecoveryActions({ data, path }: { data: ApplicationDetail; path: string }) {
  const action=useDetailAction(path), [note,setNote]=useState(''), [message,setMessage]=useState('');
  const recovery=data.recovery;
  if (!recovery) return null;
  return <section className="panel orig-panel"><div className="panelhead"><div><span className="eyebrow"><i/> Recovery roadmap</span><h2>Understand the decision</h2></div><GitBranch size={21}/></div>
    {recovery.reasons.length>0 && <ul className="prose-list">{recovery.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul>}
    {recovery.reason_codes.length>0 && <p className="orig-note">Decision codes · {recovery.reason_codes.join(' · ')}</p>}
    <ol className="orig-milestones">{recovery.milestones.map((m,i)=><li key={i}><span>{i+1}</span><div><strong>{m.title}</strong><p>{m.detail}</p></div></li>)}</ol>
    <p>Reassessment uses the current evidence and simulated policy. Outcomes can change as those inputs change.</p>
    <div className="buttonrow"><Button asChild variant="outline" size="small"><Link href="/app/profile">Review my profile<ArrowRight size={14}/></Link></Button>
      {recovery.alternatives.map(p=><Link className="under" key={p.slug} href={'/app/market/'+p.slug}>{p.name}</Link>)}</div>
    <div className="orig-next"><h3>Request reassessment</h3><p>{recovery.reassessment_eligible?'Your updated evidence is available for another review.':'Update relevant financial information before requesting reassessment.'}</p>
      <Button type="button" variant="outline" size="small" disabled={action.isPending || !recovery.reassessment_eligible} onClick={()=>action.mutate({action:'reassess'},{onSuccess:()=>setMessage('Reassessment requested.')})}>Request reassessment</Button></div>
    <details className="orig-details"><summary>Ask for human review</summary><form className="formstack" onSubmit={event=>{event.preventDefault();action.mutate({action:'appeal',body:{note:note.trim()}},{onSuccess:()=>{setNote('');setMessage('Human review requested.');}});}}>
      <label>Why should this decision be reviewed?<textarea required maxLength={600} rows={3} value={note} onChange={event=>setNote(event.target.value)} placeholder="Describe the evidence or figures you would like reviewed."/></label>
      <div><Button type="submit" size="small" disabled={action.isPending || !note.trim()}>Submit review request</Button></div></form></details>
    {action.error&&<Failure message={errText(action.error)}/>}<StatusMessage>{message}</StatusMessage></section>;
}

function WizardProgress({ step, change, preview, documentsReady }: { step:number;change?:(step:number)=>void;preview:boolean;documentsReady:boolean }) {
  return <nav className="orig-steps" aria-label="Application steps">{steps.map((label,i)=>{
    const enabled=Boolean(change) && (i<2 || (preview && (i<4 || documentsReady)));
    return <button key={label} type="button" aria-current={step===i?'step':undefined} disabled={!enabled} onClick={()=>change?.(i)}>
      <span aria-hidden="true">{i<step ? <Check size={13}/> : i+1}</span>{label}</button>;
  })}</nav>;
}

function DraftEditor({ data, products, path }: { data:ApplicationDetail; products:Product[];path:string }) {
  const app=data.application,cache=useQueryClient(),action=useDetailAction(path);
  const missing=data.required_documents.filter(kind=>!data.documents.some(doc=>doc.kind===kind)), verified=data.kyc?.status==='verified';
  const [step,setStep]=useState(app.status==='requires_information' ? 3 : 0),[confirmed,setConfirmed]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const choice=new URLSearchParams(window.location.search).get('step');
    if(choice!==null && /^\d$/.test(choice)) setStep(Math.min(4,Number(choice)));
  },[]);
  function navigate(next:number) {
    setMessage('');setStep(next);setConfirmed(false);
    const url=new URL(window.location.href);url.searchParams.set('step',String(next));window.history.replaceState(window.history.state,'',url);
  }
  const view=(!app.preview_token || !data.assessment) && step>=2 && app.status!=='requires_information' ? 1 : step;
  const latestRequest=data.timeline.slice().reverse().find(event=>event.status==='requires_information');
  return <><WizardProgress step={view} change={navigate} preview={Boolean(app.preview_token)} documentsReady={!missing.length}/>
    {app.status==='requires_information' && <div className="orig-attention"><strong>Information requested</strong><p>{latestRequest?.note || 'Review your details and supporting documents before resubmitting.'}</p></div>}
    {view===0 && <RequestForm data={data} products={products} onSaved={result=>{cache.setQueryData(['api',path],result);navigate(1);}}/>}
    {view===1 && <><FinancialEvidence data={data}/><section className="panel orig-panel"><h2>Run an eligibility preview</h2><p>The service will check the product, profile and affordability rules and generate a repayment illustration for this request.</p>
      <div className="buttonrow"><Button type="button" disabled={action.isPending} onClick={()=>action.mutate({action:'preview'},{onSuccess:()=>navigate(2)})}>{action.isPending?'Checking…':'Run eligibility preview'}<ArrowRight size={16}/></Button></div></section></>}
    {view===2 && data.assessment && <><div className="orig-split"><Eligibility value={data.assessment}/><OfferNumbers quote={data.assessment.quote}/></div>
      <div className="buttonrow"><Button type="button" onClick={()=>navigate(3)}>Continue to documents<ArrowRight size={16}/></Button></div></>}
    {view===3 && <><EvidenceList path={path} data={data} editable/><div className="buttonrow">
      {app.preview_token ? <Button type="button" disabled={Boolean(missing.length)} onClick={()=>navigate(4)}>Review application<ArrowRight size={16}/></Button>
        : <Button type="button" onClick={()=>navigate(1)}>Update eligibility preview<ArrowRight size={16}/></Button>}
      {missing.length>0 && <span className="orig-note">{missing.length} {missing.length===1?'document':'documents'} still required.</span>}</div></>}
    {view===4 && <section className="panel orig-panel"><div className="panelhead"><div><span className="eyebrow"><i/> Final check</span><h2>Confirm your application</h2></div><BadgeCheck size={23}/></div>
      <dl className="orig-facts"><div><dt>Product</dt><dd>{products.find(p=>p.slug===app.product_slug)?.name}</dd></div><div><dt>Purpose</dt><dd>{app.purpose}</dd></div>
        <div><dt>Requested amount</dt><dd>{money(app.principal)}</dd></div><div><dt>Repayment term</dt><dd>{app.months} months</dd></div>
        {data.assessment && <><div><dt>Estimated EMI</dt><dd>{money(data.assessment.quote.emi)}</dd></div><div><dt>Total including charges</dt><dd>{money(data.assessment.quote.total_cost)}</dd></div></>}
        <div><dt>Supporting documents</dt><dd>{data.required_documents.length-missing.length} / {data.required_documents.length} attached</dd></div></dl>
      {!verified && <div className="orig-attention"><p>Complete simulated KYC verification to submit this application.</p><Link className="under" href="/app/kyc">Open identity verification</Link></div>}
      <label className="orig-consent"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>I reviewed the repayment costs and synthetic documents and want to submit this application.</span></label>
      <div className="buttonrow"><Button type="button" disabled={action.isPending || !confirmed || !verified || Boolean(missing.length) || !app.preview_token}
        onClick={()=>action.mutate({action:app.status==='requires_information'?'resubmit':'submit',body:{confirmed:true,preview_token:app.preview_token}},
          {onSuccess:()=>setMessage('Application submitted for review.')})}>{action.isPending?'Submitting…':app.status==='requires_information'?'Resubmit application':'Submit application'}<ArrowRight size={16}/></Button>
        <Button type="button" variant="ghost" onClick={()=>navigate(1)}>Refresh eligibility preview</Button></div></section>}
    {action.error&&<Failure message={errText(action.error)}/>}<StatusMessage>{message}</StatusMessage></>;
}

function Withdraw({ path }: { path:string }) {
  const action=useDetailAction(path);
  return <details className="panel orig-panel orig-withdraw"><summary>Withdraw application</summary><p>Withdrawing ends this request and keeps its audit history.</p>
    <Button type="button" size="small" variant="outline" disabled={action.isPending} onClick={()=>action.mutate({action:'withdraw'})}>{action.isPending?'Withdrawing…':'Confirm withdrawal'}</Button>
    {action.error&&<Failure message={errText(action.error)}/>}</details>;
}

function Acceptance({ data,path }: { data:ApplicationDetail;path:string }) {
  const [consent,setConsent]=useState(false),action=useDetailAction(path), offer=data.offer;
  if(!offer) return null;
  return <><OfferNumbers quote={offer.quote}/><section className="panel orig-panel"><div className="panelhead"><div><span className="eyebrow"><i/> Simulated offer · version {offer.version}</span>
    <h2>{data.application.status==='approved'?'Review and accept the terms':'Your terms are accepted'}</h2></div><FileCheck2 size={22}/></div>
    {data.application.status==='approved'?<><p>Issued {date(offer.issued_at)} for {offer.product.name}. Review the schedule and charges before accepting this version.</p>
      <label className="orig-consent"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>I accept the simulated terms and repayment schedule shown above.</label>
      <Button type="button" disabled={!consent||action.isPending} onClick={()=>action.mutate({action:'accept',body:{confirmed:true,offer_version:offer.version}})}>Accept simulated terms<Check size={16}/></Button></> :
      <><p>Create the simulated disbursement and open the loan account with the agreed schedule.</p><div className="buttonrow"><Button disabled={action.isPending} type="button"
        onClick={()=>action.mutate({action:'disburse'})}>Simulate disbursement<ArrowRight size={16}/></Button></div></>}
    {action.error&&<Failure message={errText(action.error)}/>}</section></>;
}

function TrackingHeader({ data, back, admin = false }: { data:ApplicationDetail;back:string;admin?:boolean }) {
  const app=data.application;
  return <><Link className="orig-back" href={back}><ArrowLeft size={15}/>{admin?'Underwriting queue':'All applications'}</Link>
    <PageHeading kicker={admin?'Underwriting record':'Application tracking'} title={app.product_name || data.assessment?.product.name || human(app.product_slug)+' loan'}
      description={(admin && app.applicant_name ? app.applicant_name+' · ' : '')+reference(app)} action={<div className="buttonrow"><StageBadge status={app.status}/><PdfButton path={(admin?'admin/reports/pdf/application/':'reports/pdf/application/')+app.id} label="Summary PDF"/></div>}/>
    <div className="metricgrid orig-summary"><Metric label="Requested principal" value={money(app.principal)}/><Metric label="Repayment term" value={app.months+' months'}/>
      <Metric label="Last activity" value={date(app.updated_at)}/></div></>;
}

function ApplicationView({ id }: { id:string }) {
  const path='applications/'+encodeURIComponent(id);
  const query=useResource<ApplicationDetail>(path),products=useResource<{items:Product[]}>('products');
  const stage=query.data?.application.status,refetch=query.refetch;
  useEffect(()=>{if(stage!=='submitted' && stage!=='disbursed')return;const timer=setInterval(()=>void refetch(),2000);return()=>clearInterval(timer);},[stage,refetch]);
  if(query.isPending||products.isPending)return <Loading/>;
  if(query.error||products.error)return <Failure message={errText(query.error||products.error)} retry={()=>{void query.refetch();void products.refetch();}}/>;
  const data=query.data,app=data.application,editable=app.status==='draft'||app.status==='requires_information';
  return <div className="orig-page"><TrackingHeader data={data} back="/app/applications"/>
    {editable?<DraftEditor data={data} products={products.data.items} path={path}/> :
      <>{['submitted','under_review','disbursed'].includes(app.status) && <div className="orig-attention"><div><strong>{app.status==='disbursed'?'Finalising the loan account':'Your application is in review'}</strong>
        <p>{app.status==='disbursed'?'Your simulated loan account will appear after activation.':'Review updates and any requests for information appear here.'}</p></div>
        <Button type="button" variant="outline" size="small" onClick={()=>query.refetch()}><RotateCw size={14}/>Refresh</Button></div>}
        {(app.status==='approved'||app.status==='accepted') && <Acceptance data={data} path={path}/>}
        {app.status==='rejected' && <RecoveryActions data={data} path={path}/>}
        {app.loan_id && <section className="panel orig-panel"><h2>Loan account</h2><div className="buttonrow"><Button asChild><Link href={'/app/loans/'+app.loan_id}>Open loan account<ArrowRight size={16}/></Link></Button></div></section>}
        {data.assessment && !['approved','accepted'].includes(app.status) && <Eligibility value={data.assessment}/>}
        <EvidenceList data={data} path={path}/></>}
    <ActivityTimeline events={data.timeline}/>{['draft','submitted','under_review','requires_information','approved'].includes(app.status)&&<Withdraw path={path}/>}</div>;
}

function NewApplication() {
  const products=useResource<{items:Product[]}>('products'), cache=useQueryClient(), router=useRouter(), [initial,setInitial]=useState<string|null>(null);
  useEffect(()=>setInitial(new URLSearchParams(window.location.search).get('product') ?? ''),[]);
  if(products.isPending||initial===null)return <Loading/>;
  if(products.error)return <Failure message={errText(products.error)} retry={()=>products.refetch()}/>;
  if(!products.data.items.length)return <Empty title="No products available"/>;
  return <div className="orig-page"><Link className="orig-back" href="/app/applications"><ArrowLeft size={15}/>All applications</Link>
    <PageHeading kicker="Loan origination" title="New application" description="Save your request, review the costs and submit supporting synthetic evidence."/>
    <WizardProgress step={0} preview={false} documentsReady={false}/><RequestForm initialSlug={initial} products={products.data.items} onSaved={data=>{
      cache.setQueryData(['api','applications/'+data.application.id],data);void cache.invalidateQueries({predicate:q=>typeof q.queryKey[1]==='string'&&q.queryKey[1].startsWith('applications?')});
      router.replace('/app/applications/'+data.application.id+'?step=1');
    }}/></div>;
}

const allFilters={q:'',status:'',product:'',risk:'',priority:''};
function ApplicationList({ admin = false }: { admin?:boolean }) {
  const [draft,setDraft]=useState(allFilters),[filters,setFilters]=useState(allFilters),[page,setPage]=useState(1);
  const [sort,setSort]=useState<{key:string;dir:'asc'|'desc'}|null>(null);
  const products=useResource<{items:Product[]}>('products');
  const params=new URLSearchParams({page:String(page),page_size:'12'});
  for(const [key,value] of Object.entries(filters))if(value)params.set(key,value);
  if(sort){params.set('sort',sort.key);params.set('dir',sort.dir);}
  const base=admin?'/admin/applications':'/app/applications';
  const query=useResource<PageResult>((admin?'admin/':'')+'applications?'+params.toString());
  function toggleSort(key:string){setPage(1);setSort(s=>!s||s.key!==key?{key,dir:'asc'}:s.dir==='asc'?{key,dir:'desc'}:null);}
  const sortHead=(key:string,label:string)=><th scope="col" aria-sort={sort?.key===key?(sort.dir==='asc'?'ascending':'descending'):undefined}><button type="button" className="sort-button" onClick={()=>toggleSort(key)}>{label}<span aria-hidden="true">{sort?.key===key?(sort.dir==='asc'?'▲':'▼'):'↕'}</span></button></th>;
  function update(key:keyof typeof allFilters,value:string){setDraft(previous=>({...previous,[key]:value}));}
  return <div className="orig-page"><PageHeading kicker={admin?'Operations':'Borrower workspace'} title={admin?'Underwriting queue':'Loan applications'}
    description={admin?'Review requests, inspect evidence and record a decision for each application.':'Track your requests from the first draft to an active loan account.'}
    action={!admin&&<Button asChild><Link href="/app/applications/new"><Plus size={16}/>New application</Link></Button>}/>
    <form className="panel orig-panel orig-filters" onSubmit={event=>{event.preventDefault();setFilters({...draft,q:draft.q.trim()});setPage(1);}}>
      <div className="controlgrid"><label>Search applications<input type="search" value={draft.q} onChange={event=>update('q',event.target.value)} placeholder={admin?'Tracking ID or applicant':'Tracking ID or product'}/></label>
        <label>Application status<select value={draft.status} onChange={event=>update('status',event.target.value)}><option value="">All statuses</option>{stages.map(stage=><option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></label>
        <label>Product<select value={draft.product} onChange={event=>update('product',event.target.value)}><option value="">All products</option>{products.data?.items.map(product=><option key={product.slug} value={product.slug}>{product.name}</option>)}</select></label></div>
      {admin&&<div className="controlgrid"><label>Assessed risk<select value={draft.risk} onChange={event=>update('risk',event.target.value)}><option value="">Any risk</option>{['low','moderate','high','human_review'].map(r=><option key={r} value={r}>{human(r)}</option>)}</select></label>
        <label>Priority<select value={draft.priority} onChange={event=>update('priority',event.target.value)}><option value="">All priorities</option><option value="escalated">Escalated cases</option></select></label></div>}
      <div className="buttonrow"><Button size="small" type="submit" variant="outline"><Search size={14}/>Apply filters</Button>
        {Object.values(filters).some(Boolean)&&<Button type="button" variant="ghost" size="small" onClick={()=>{setDraft(allFilters);setFilters(allFilters);setPage(1);}}>Clear filters</Button>}</div>
    </form>{products.error && <Failure message={errText(products.error)} retry={()=>products.refetch()}/>}
    {query.isPending?<Loading/>:query.error?<Failure message={errText(query.error)} retry={()=>query.refetch()}/>:query.data.items.length===0 ?
      <Empty title="No matching applications">{admin?'Submitted requests appear here when they match the filters.':'Create a draft or adjust the filters to find an existing request.'}</Empty>:
      <section className="panel orig-panel orig-list"><div className="panelhead"><h2>{query.data.total} {query.data.total===1?'application':'applications'}</h2><ClipboardCheck size={19}/></div>
        <div className="tablewrap" role="region" aria-label="Application records" tabIndex={0}><table className="datatable"><caption className="sr-only">Application records. Use the column buttons to sort.</caption><thead><tr>{sortHead('product','Application')}{admin&&sortHead('applicant','Applicant')}
          {sortHead('amount','Amount')}{sortHead('status','Status')}{sortHead('updated','Updated')}<th scope="col">Details</th></tr></thead>
          <tbody>{query.data.items.map(app=><tr key={app.id}><td><strong>{app.product_name || human(app.product_slug)}</strong><small>{reference(app)}</small></td>{admin&&<td>{app.applicant_name}</td>}
            <td>{money(app.principal)}</td><td><StageBadge status={app.status}/>{app.escalated&&<small>Escalated</small>}</td><td>{date(app.updated_at)}</td>
            <td><Link className="under" href={base+'/'+app.id} aria-label={'Open '+reference(app)}>Open</Link></td></tr>)}</tbody></table></div>
        <div className="orig-pagination"><span>Page {page} of {Math.max(1,Math.ceil(query.data.total/query.data.page_size))}</span>
          <Button type="button" size="small" variant="outline" disabled={page<=1} onClick={()=>setPage(page-1)}><ChevronLeft size={14}/>Previous</Button>
          <Button type="button" size="small" variant="outline" disabled={page*query.data.page_size>=query.data.total} onClick={()=>setPage(page+1)}>Next<ChevronRight size={14}/></Button></div>
      </section>}</div>;
}

function DecisionForm({ data,path }: { data:ApplicationDetail;path:string }) {
  const [decision,setDecision]=useState('approve'),[note,setNote]=useState(''),[code,setCode]=useState('affordability'),
    [staged,setStaged]=useState(false),[message,setMessage]=useState('');
  const action=useDetailAction(path), stage=data.application.status;
  if(stage!=='submitted'&&stage!=='under_review')return null;
  const current=stage==='submitted'?'review':decision;
  const titles:Record<string,string>={approve:'Approve application',reject:'Reject application',request_information:'Request information',escalate:'Escalate for review',review:'Begin review'};
  function record() {
    action.mutate({action:'decision',body:{action:current,note:note.trim(),...(current==='reject'?{reason_code:code}:{})}},{
      onSuccess:()=>{setStaged(false);setNote('');setMessage('Decision recorded in the application activity.');},
    });
  }
  return <section className="panel orig-panel"><div className="panelhead"><div><span className="eyebrow"><i/> Administrator action</span><h2>Underwriting decision</h2></div><ClipboardCheck size={20}/></div>
    {staged?<div className="orig-staged"><h3>Confirm your decision</h3><p><strong>{titles[current]}</strong> · {data.application.tracking_id}</p><blockquote>{note}</blockquote>
      <div className="buttonrow"><Button disabled={action.isPending} type="button" onClick={record}>{action.isPending?'Recording…':'Confirm decision'}<Check size={15}/></Button>
        <Button type="button" variant="ghost" disabled={action.isPending} onClick={()=>setStaged(false)}>Edit decision</Button></div></div>:
      <form className="formstack" onSubmit={event=>{event.preventDefault();setMessage('');setStaged(true);}}>
        <label>Decision<select aria-label="Decision" value={current} onChange={event=>setDecision(event.target.value)}>{(stage==='submitted'?['review']:['approve','reject','request_information','escalate']).map(value=><option key={value} value={value}>{titles[value]}</option>)}</select></label>
        {current==='reject'&&<label>Decision reason code<select value={code} onChange={event=>setCode(event.target.value)}>
          {['affordability','income_continuity','product_limits','documentation','credit_evidence','underwriting_review'].map(item=><option key={item} value={item}>{human(item)}</option>)}</select></label>}
        <label>Decision note<textarea required maxLength={600} rows={3} value={note} onChange={event=>setNote(event.target.value)} placeholder="Explain the evidence behind the decision and any next step for the applicant."/></label>
        <div><Button type="submit" disabled={!note.trim()}>Review decision<ArrowRight size={15}/></Button></div></form>}
    {action.error&&<Failure message={errText(action.error)}/>}<StatusMessage>{message}</StatusMessage></section>;
}

function UnderwritingRecord({ id }: { id:string }) {
  const path='admin/applications/'+encodeURIComponent(id), query=useResource<ApplicationDetail>(path);
  if(query.isPending)return <Loading/>;
  if(query.error)return <Failure message={errText(query.error)} retry={()=>query.refetch()}/>;
  const data=query.data,app=data.application;
  return <div className="orig-page"><TrackingHeader data={data} back="/admin/applications" admin/>
    <section className="panel orig-panel"><div className="panelhead"><h2>Applicant request</h2><FileText size={19}/></div><p>{app.purpose}</p>
      {app.escalated&&<p className="orig-note">Escalated for human review.</p>}</section>
    <div className="orig-split"><FinancialEvidence data={data} admin/>{data.assessment?<Eligibility value={data.assessment}/>:<section className="panel"><Empty title="No submitted assessment">An eligibility preview will appear as the draft progresses.</Empty></section>}</div>
    <EvidenceList data={data} path={path}/>
    <section className="panel orig-panel"><div className="panelhead"><h2>Investigation signals</h2><ShieldCheck size={20}/></div>
      {!data.fraud_alerts?.length ? <p>No alerts are recorded for this application.</p> : <ul className="prose-list">{data.fraud_alerts.map((alert,i)=><li key={alert.id??alert.rule??i}><strong>{human(alert.severity)} · {human(alert.rule||'Administrative review')}</strong> {alert.evidence || alert.explanation} {alert.status&&'· '+human(alert.status)}</li>)}</ul>}</section>
    {data.assessment&&<OfferNumbers quote={data.offer?.quote ?? data.assessment.quote}/>}
    <DecisionForm data={data} path={path}/><ActivityTimeline events={data.timeline}/></div>;
}

function RecoveryRecord({ id }: { id:number }) {
  const path='applications/'+id,query=useResource<ApplicationDetail>(path);
  if(query.isPending)return <Loading/>;
  if(query.error)return <Failure message={errText(query.error)} retry={()=>query.refetch()}/>;
  return <><RecoveryActions data={query.data} path={path}/><Link className="under" href={'/app/applications/'+id}>View full application activity</Link></>;
}

export function RecoveryPage() {
  const [page,setPage]=useState(1),[selected,setSelected]=useState<number|null>(null);
  const query=useResource<PageResult>('applications?status=rejected&page='+page+'&page_size=10');
  if(query.isPending)return <Loading/>;
  if(query.error)return <Failure message={errText(query.error)} retry={()=>query.refetch()}/>;
  const rows=query.data.items,active=rows.find(row=>row.id===selected) ?? rows[0];
  return <div className="orig-page"><PageHeading kicker="Borrower support" title="Financial recovery" description="Review reasons for a decision, work through recovery milestones and ask for another assessment."/>
    {rows.length?<><section className="panel orig-panel"><label>Rejected application<select value={active.id} onChange={event=>setSelected(Number(event.target.value))}>
      {rows.map(row=><option key={row.id} value={row.id}>{row.product_name} · {row.tracking_id}</option>)}</select></label>
      {query.data.total>query.data.page_size&&<div className="orig-pagination"><span>Page {page}</span><Button size="small" type="button" variant="outline" disabled={page===1} onClick={()=>{setPage(page-1);setSelected(null);}}>Previous</Button>
        <Button size="small" type="button" variant="outline" disabled={page*query.data.page_size>=query.data.total} onClick={()=>{setPage(page+1);setSelected(null);}}>Next</Button></div>}</section>
      <RecoveryRecord key={active.id} id={active.id}/></>:<section className="panel"><Empty title="No rejected applications">A recovery roadmap appears here when a simulated application is declined.</Empty>
        <div className="buttonrow"><Button asChild size="small" variant="outline"><Link href="/app/applications">View applications<ArrowRight size={14}/></Link></Button></div></section>}</div>;
}

export function ApplicationsPage({ parts }: { parts:string[] }) {
  if(parts[0]==='new')return <NewApplication/>;
  if(parts[0])return <ApplicationView key={parts[0]} id={parts[0]}/>;
  return <ApplicationList/>;
}
export function UnderwritingPage({ parts }: { parts:string[] }) {
  return parts[0]?<UnderwritingRecord key={parts[0]} id={parts[0]}/>:<ApplicationList admin/>;
}
