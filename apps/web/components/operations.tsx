'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {ArrowRight,Bell,CheckCheck,ReceiptText} from 'lucide-react';
import {api,date,errText,human,money,useResource} from '@/lib/api';
import {Button} from './ui/button';
import {ExportTools} from './exports';
import {PdfButton} from './pdf-button';
import {Empty,Failure,Loading,Metric,PageHeading} from './states';
import './planning.css';

interface Note{id:number;kind:string;title:string;body:string;link:string;read_at:string|null;created_at:string}
export function NotificationsPage(){
 const q=useResource<{items:Note[];unread:number}>('notifications'),cache=useQueryClient();
 const read=useMutation({mutationFn:(id?:number)=>api('notifications/read',id?{id}:{}),onSuccess:()=>cache.invalidateQueries({queryKey:['api']})});
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 return <><PageHeading kicker="Account" title="Notifications" description="Decisions, payment receipts and upcoming instalments for your loans." action={q.data.unread>0?<Button variant="outline" size="small" disabled={read.isPending} onClick={()=>read.mutate(undefined)}><CheckCheck size={15}/>Mark all read</Button>:undefined}/>
 <section className="panel">{!q.data.items.length?<Empty title="You are up to date">Application decisions and payment reminders appear here.</Empty>:q.data.items.map(n=><div key={n.id} className={'notif'+(n.read_at?'':' unread')}><span className="notif-icon"><Bell size={17}/></span><div><strong>{n.title}</strong><p>{n.body}</p>{n.link&&<Link className="textlink" href={n.link} onClick={()=>!n.read_at&&read.mutate(n.id)}>Open <ArrowRight size={13}/></Link>}</div><small>{date(n.created_at)}</small></div>)}</section></>;
}

interface Report{loans:{id:number;product:string;principal:number;outstanding:number;emi:number;status:string;opened_on:string;interest_paid:number;paid:number}[];applications:{status:string;count:number}[];payments:{reference:string;loan_id:number;kind:string;amount:number;principal:number;interest:number;fee:number;penalty:number;payment_date:string}[];score_history:{score:number|null;strategy:string;created_at:string}[]}
export function ReportsPage(){
 const q=useResource<Report>('reports');
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const r=q.data,borrowed=r.loans.reduce((t,l)=>t+l.principal,0),paid=r.loans.reduce((t,l)=>t+l.paid,0),interest=r.loans.reduce((t,l)=>t+l.interest_paid,0);
 return <><PageHeading kicker="Account" title="My reports" description="A statement of your loans, payments and score history." action={<span className="buttonrow no-print"><PdfButton path="reports/pdf/health" label="Financial health PDF"/><PdfButton path="reports/pdf/credit" label="Credit report PDF"/></span>}/>
 <div className="metricgrid"><Metric label="Borrowed" value={money(borrowed)}/><Metric label="Repaid" value={money(paid)}/><Metric label="Interest paid" value={money(interest)}/><Metric label="Outstanding" value={money(r.loans.filter(l=>l.status!=='closed').reduce((t,l)=>t+l.outstanding,0))}/></div>
 <section className="panel"><div className="panelhead"><h2>Loans</h2><ReceiptText size={18}/></div>{!r.loans.length?<Empty title="No loans yet">Loans appear here after disbursement.</Empty>:<><div className="tablewrap"><table className="datatable"><thead><tr>{['Loan','Product','Principal','Outstanding','EMI','Status','PDF'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{r.loans.map(l=><tr key={l.id}><th scope="row"><Link className="textlink" href={'/app/loans/'+l.id}>Loan {l.id}</Link></th><td>{l.product}</td><td>{money(l.principal)}</td><td>{money(l.outstanding)}</td><td>{money(l.emi)}</td><td>{human(l.status)}</td><td><PdfButton path={(l.status==='closed'?'reports/pdf/certificate/':'reports/pdf/loan/')+l.id} label={l.status==='closed'?'Certificate':'Statement'}/></td></tr>)}</tbody></table></div><ExportTools name="my-loans" columns={['Loan','Product','Principal (paise)','Outstanding (paise)','EMI (paise)','Status','Opened']} rows={r.loans.map(l=>[l.id,l.product,l.principal,l.outstanding,l.emi,l.status,l.opened_on])}/></>}</section>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Payment history</h2></div>{!r.payments.length?<Empty title="No payments recorded"/>:<><div className="tablewrap"><table className="datatable"><thead><tr>{['Reference','Date','Type','Amount'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{r.payments.slice(0,15).map(p=><tr key={p.reference}><th scope="row">{p.reference}</th><td>{date(p.payment_date)}</td><td>{human(p.kind)}</td><td>{money(p.amount)}</td></tr>)}</tbody></table></div><ExportTools name="my-payments" columns={['Reference','Loan','Type','Amount (paise)','Principal (paise)','Interest (paise)','Fee (paise)','Penalty (paise)','Date']} rows={r.payments.map(p=>[p.reference,p.loan_id,p.kind,p.amount,p.principal,p.interest,p.fee,p.penalty,p.payment_date])}/></>}</section>
 <section className="panel"><div className="panelhead"><h2>Score history</h2></div>{!r.score_history.length?<Empty title="No assessments yet"/>:<div className="historylist">{r.score_history.map((s,i)=><div key={i}><span>{date(s.created_at)}</span><strong>{s.score??'Needs evidence'}</strong></div>)}</div>}</section></div></>;
}

interface Portfolio{totals:Record<string,number>;by_status:{status:string;count:number}[];by_product:{name:string;applications:number;approved:number;disbursed:number}[];risk_bands:{risk:string;count:number}[];collections:{month:string;amount:number;payments:number}[]}
export function usePortfolio(){return useResource<Portfolio>('admin/overview');}
export function PortfolioMetrics({t}:{t:Record<string,number>}){
 const rate=t.approved_total+t.rejected_total>0?Math.round(100*t.approved_total/(t.approved_total+t.rejected_total))+'%':'No decisions yet';
 return <div className="metricgrid"><Metric label="Customers" value={t.customers}/><Metric label="In underwriting queue" value={t.queue}/><Metric label="Approval rate" value={rate} detail={t.approved_total+' approved · '+t.rejected_total+' rejected'}/><Metric label="Active loans" value={t.loans_active} detail={t.loans_defaulted+' defaulted · '+t.loans_closed+' closed'}/><Metric label="Disbursed" value={money(t.disbursed)}/><Metric label="Outstanding principal" value={money(t.outstanding)}/><Metric label="Collected" value={money(t.collected)} detail={'Interest '+money(t.interest_collected)}/><Metric label="Loans with overdue instalments" value={t.overdue_loans}/></div>;
}
export function AdminReportsPage(){
 const q=usePortfolio();
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const r=q.data,max=Math.max(1,...r.by_product.map(p=>p.applications));
 return <><PageHeading kicker="Portfolio" title="Portfolio reports" description="Figures calculated from the loan ledger and application records." action={<PdfButton path="admin/reports/pdf/portfolio" label="Download PDF"/>}/>
 <PortfolioMetrics t={r.totals}/>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Applications by product</h2></div><div className="bar-list">{r.by_product.map(p=><div className="bar-row" key={p.name}><span>{p.name}</span><progress aria-label={p.name} value={p.applications} max={max}/><b>{p.applications}</b></div>)}</div><ExportTools name="product-portfolio" columns={['Product','Applications','Approved','Disbursed (paise)']} rows={r.by_product.map(p=>[p.name,p.applications,p.approved,p.disbursed])}/></section>
 <section className="panel"><div className="panelhead"><h2>Applications by status</h2></div>{r.by_status.length?<div className="historylist">{r.by_status.map(s=><div key={s.status}><span>{human(s.status)}</span><strong>{s.count}</strong></div>)}</div>:<Empty title="No applications yet"/>}<div className="panelhead"><h2>Borrower risk bands</h2></div>{r.risk_bands.length?<div className="historylist">{r.risk_bands.map(s=><div key={s.risk}><span>{human(s.risk)}</span><strong>{s.count}</strong></div>)}</div>:<Empty title="No assessments yet"/>}</section></div>
 <section className="panel"><div className="panelhead"><h2>Monthly collections</h2></div>{r.collections.length?<><div className="tablewrap"><table className="datatable"><thead><tr><th scope="col">Month</th><th scope="col">Payments</th><th scope="col">Collected</th></tr></thead><tbody>{r.collections.map(c=><tr key={c.month}><th scope="row">{c.month}</th><td>{c.payments}</td><td>{money(c.amount)}</td></tr>)}</tbody></table></div><ExportTools name="monthly-collections" columns={['Month','Payments','Collected (paise)']} rows={r.collections.map(c=>[c.month,c.payments,c.amount])}/></>:<Empty title="No collections yet"/>}</section></>;
}

interface Case{id:number;user_name:string;email:string;rule:string;subject:string;severity:string;evidence:string;status:string;note:string;created_at:string}
const ruleNames:Record<string,string>={shared_synthetic_identity:'Shared synthetic identity',repeated_submissions:'Repeated submissions',amount_exceeds_income:'Amount exceeds income',early_foreclosure:'Early foreclosure'};
function CaseCard({c}:{c:Case}){
 const cache=useQueryClient(),[note,setNote]=useState(c.note);
 const decide=useMutation({mutationFn:(status:string)=>api('admin/fraud/'+c.id,{status,note}),onSuccess:()=>cache.invalidateQueries({queryKey:['api']})});
 return <article className="panel"><div className="panelhead"><h2>{ruleNames[c.rule]||human(c.rule)}</h2><span className={'sev '+c.severity}>{c.severity==='high'?'High priority':'Review'}</span></div><p><strong>{c.user_name}</strong> · {c.email}</p><p>{c.evidence}</p><p className="muted">Opened {date(c.created_at)} · Status: {human(c.status)}</p>
 <div className="case-actions"><label>Investigator note<input value={note} maxLength={600} onChange={e=>setNote(e.target.value)}/></label>{c.status!=='investigating'&&<Button variant="outline" size="small" disabled={decide.isPending} onClick={()=>decide.mutate('investigating')}>Investigate</Button>}<Button variant="outline" size="small" disabled={decide.isPending||!note.trim()} onClick={()=>decide.mutate('cleared')}>Clear</Button><Button size="small" disabled={decide.isPending||!note.trim()} onClick={()=>decide.mutate('confirmed')}>Confirm concern</Button></div>{decide.error&&<Failure message={errText(decide.error)}/>}</article>;
}
export function FraudPage(){
 const [status,setStatus]=useState('open'),q=useResource<{items:Case[]}>('admin/fraud'+(status?'?status='+status:''));
 return <><PageHeading kicker="Risk operations" title="Fraud review" description="Rule-based screening of synthetic activity. Every decision is recorded with the investigator’s note."/>
 <section className="panel"><label>Case status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All cases</option>{['open','investigating','cleared','confirmed'].map(s=><option key={s} value={s}>{human(s)}</option>)}</select></label></section>
 {q.isPending?<Loading/>:q.error?<Failure message={q.error.message} retry={()=>q.refetch()}/>:!q.data.items.length?<Empty title="No cases">No activity matches this status.</Empty>:q.data.items.map(c=><CaseCard key={c.id+c.status} c={c}/>)}</>;
}
