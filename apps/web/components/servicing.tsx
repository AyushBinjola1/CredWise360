'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BadgeCheck,Banknote,CalendarDays,CheckCircle2,Download,FileCheck2,FileText,Printer,ReceiptText,Search,Wallet} from 'lucide-react';
import {date,human,money,useResource} from '@/lib/api';
import {certificateRows,downloadCertificate,paymentLabels,type Certificate,type LoanDetail,type LoanRecord,type PostedTransaction,type Receipt,type ScheduleRow} from '@/lib/servicing';
import {Button} from './ui/button';
import {Empty,Failure,Loading,Metric,PageHeading} from './states';
import {ExportTools} from './exports';
import {LoanPayment} from './loan-payment';
import './servicing.css';

function LoanDirectory({admin,repayments}:{admin:boolean;repayments:boolean}){
 const endpoint=admin?'admin/loans':'loans',base=admin?'/admin/loans':'/app/loans';
 const q=useResource<{items:LoanRecord[]}>(endpoint);
 const [filter,setFilter]=useState(repayments?'active':'all'),[search,setSearch]=useState('');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const items=(q.data?.items||[]).filter(l=>(filter==='all'||filter===l.status||(filter==='overdue'&&l.status!=='closed'&&l.next_due_date&&l.next_due_date<today))&&[l.product_name,l.borrower_name,l.id,l.application_id].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
 if(repayments)items.sort((a,b)=>(a.next_due_date||'9999').localeCompare(b.next_due_date||'9999')||a.id-b.id);
 const title=repayments?(admin?'Repayment monitoring':'Repayments'):(admin?'Loan portfolio':'My loans');
 return <><PageHeading kicker={admin?'Loan operations':'Loan servicing'} title={title} description={repayments?'Review scheduled payments, outstanding dues and recorded collections.':'Track balances, repayment schedules and the history of your simulated loans.'}/>
 <section className="panel"><div className="service-filters"><label>Search loans<input type="search" value={search} placeholder={admin?'Borrower, product or loan number':'Product or loan number'} onChange={e=>setSearch(e.target.value)}/></label><label>Loan status<select value={filter} onChange={e=>setFilter(e.target.value)}>{['all','active','overdue','closed','defaulted'].map(s=><option key={s} value={s}>{human(s)}</option>)}</select></label></div>
 {q.isPending?<Loading/>:q.error?<Failure message={q.error.message} retry={()=>q.refetch()}/>:!items.length?<Empty title={q.data.items.length?'No matching loans':'No loans yet'}>{q.data.items.length?'Change the search or status filter.':admin?'Loans appear here after simulated disbursement.':<Link className="under" href="/app/applications">Track your applications</Link>}</Empty>:
 <div className="service-cards">{items.map(l=><Link className="service-card" href={base+'/'+l.id+(repayments&&!admin&&l.status==='active'?'#make-payment':'')} key={l.id}><div className="service-title"><span className="service-icon">{repayments?<CalendarDays size={21}/>:<Banknote size={21}/>}</span><div><strong>{l.product_name}</strong><small>{admin?l.borrower_name+' · ':''}Loan {l.id}</small></div><span className="pill">{human(l.status)}</span></div>
 <div className="service-stat"><span>{repayments?'Next scheduled amount':'Outstanding principal'}</span><b>{money(repayments?l.next_amount:l.outstanding)}</b></div><div className="service-foot"><span>{l.next_due_date?'Due '+date(l.next_due_date):l.closed_on?'Closed '+date(l.closed_on):'See repayment record'}</span><ArrowUpRight size={16}/></div></Link>)}</div>}</section></>;
}
function Schedule({rows}:{rows:ScheduleRow[]}){
 const [page,setPage]=useState(0),size=12,last=Math.max(0,Math.ceil(rows.length/size)-1),current=Math.min(last,page);
 return <><div className="tablewrap"><table className="datatable"><caption className="sr-only">Loan amortization and repayment schedule</caption><thead><tr>{['Instalment','Due date','Principal','Interest','Unpaid amount','Closing principal','Status'].map(s=><th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{rows.slice(current*size,(current+1)*size).map(r=><tr key={r.month}><th scope="row">{r.month}</th><td>{date(r.due_date)}</td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.remaining)}</td><td>{money(r.balance)}</td><td>{human(r.status)}</td></tr>)}</tbody></table></div>{last>0&&<div className="service-pager"><Button size="small" variant="outline" disabled={!current} onClick={()=>setPage(current-1)}>Previous</Button><span>Page {current+1} of {last+1}</span><Button size="small" variant="outline" disabled={current===last} onClick={()=>setPage(current+1)}>Next</Button></div>}
 <ExportTools name="loan-amortization" columns={['Instalment','Due date','Payment (paise)','Principal (paise)','Interest (paise)','Unpaid (paise)','Closing principal (paise)','Status']} rows={rows.map(r=>[r.month,r.due_date,r.payment,r.principal,r.interest,r.remaining,r.balance,r.status])}/></>;
}
function Ledger({transactions}:{transactions:PostedTransaction[]}){
 if(!transactions.length)return <Empty title="No payments recorded">A successful simulated payment will appear here with a transaction reference.</Empty>;
 return <><div className="tablewrap"><table className="datatable"><caption className="sr-only">Permanent repayment transactions</caption><thead><tr>{['Reference','Payment date','Type','Borrower cash flow','Principal posted','Interest','Penalty','Fee'].map(s=><th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{transactions.map(t=><tr key={t.id}><th scope="row">{t.reference}</th><td>{date(t.payment_date)}</td><td>{t.kind==='disbursement'?'Simulated disbursement':paymentLabels[t.kind]}</td><td>{money(t.kind==='disbursement'?t.amount:-t.amount)}</td><td>{money(t.principal)}</td><td>{money(t.interest)}</td><td>{money(t.penalty)}</td><td>{money(t.fee)}</td></tr>)}</tbody></table></div>
 <ExportTools name="loan-statement" columns={['Reference','Date','Type','Borrower cash flow (paise)','Principal (paise)','Interest (paise)','Penalty (paise)','Fee (paise)']} rows={transactions.map(t=>[t.reference,t.payment_date,t.kind,t.kind==='disbursement'?t.amount:-t.amount,t.principal,t.interest,t.penalty,t.fee])}/></>;
}
function Closure({data,back}:{data:Certificate;back:string}){return <><Link className="textlink no-print" href={back}><ArrowLeft size={15}/> Loan details</Link><article className="closure-doc"><div className="certificate-mark"><BadgeCheck size={31}/></div><span className="eyebrow">CredWise 360 · Loan servicing</span><h1>{data.title}</h1><p className="cert-ref">{data.reference}</p><p>CredWise records this simulated loan as closed on {date(data.closed_on)}.</p><dl className="service-facts">{certificateRows(data).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><small>{data.disclaimer}</small></article><div className="buttonrow"><Button onClick={()=>downloadCertificate(data)}><Download size={16}/>Download certificate</Button><Button variant="outline" onClick={()=>window.print()}><Printer size={16}/>Print certificate</Button></div></>;}
function CertificatePage({admin,id}:{admin:boolean;id:string}){
 const base=admin?'/admin/loans':'/app/loans';
 const own=useResource<Certificate>('loans/'+id+'/certificate',!admin),staff=useResource<LoanDetail>('admin/loans/'+id,admin);
 const q=admin?staff:own;
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message}/>;
 const certificate=admin?staff.data?.certificate:own.data;
 return certificate?<Closure data={certificate} back={base+'/'+id}/>:<Empty title="Certificate unavailable">A certificate is issued when the loan closes.</Empty>;
}
function LoanAccount({admin,id}:{admin:boolean;id:string}){
 const base=admin?'/admin/loans':'/app/loans',q=useResource<LoanDetail>((admin?'admin/loans/':'loans/')+id);
 const [tab,setTab]=useState<'schedule'|'history'|'charges'>('schedule'),[receipt,setReceipt]=useState<Receipt|null>(null);
 useEffect(()=>{setReceipt(null);setTab('schedule');},[id]);
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const {loan:l,schedule,transactions,penalties}=q.data;
 return <><Link href={base} className="textlink"><ArrowLeft size={15}/> {admin?'Loan portfolio':'My loans'}</Link><PageHeading kicker={'Loan account '+l.id} title={l.product_name} description={(admin?l.borrower_name+' · ':'')+'Opened '+date(l.opened_on)+' · Application '+l.application_id}/>
 <div className="balance"><div><span className="eyebrow"><i/>{human(l.status)} · Outstanding principal</span><strong>{money(l.outstanding)}</strong><p>Original principal {money(l.principal)} · {(l.rate_bps/100).toFixed(2)}% annual interest</p></div><div className="service-progress"><label htmlFor={'progress-'+l.id}>Principal repaid</label><progress id={'progress-'+l.id} max="100" value={l.progress}/><span>{l.progress.toFixed(1)}%</span></div></div>
 <div className="metricgrid"><Metric label="Contractual EMI" value={money(l.emi)}/><Metric label="Next due" value={l.next_due_date?date(l.next_due_date):'Settled'} detail={l.next_due_date?money(l.next_amount):undefined}/><Metric label="Remaining instalments" value={l.remaining_months}/><Metric label="Total paid" value={money(l.total_paid)} detail={'Interest paid '+money(l.interest_paid)}/></div>
 {receipt&&<div className="notice" role="status"><CheckCircle2 size={20}/><div><strong>Payment recorded · {money(receipt.transaction.amount)}</strong><p>{receipt.transaction.reference} · {date(receipt.transaction.payment_date)}</p></div></div>}
 {l.status==='closed'&&<section className="panel"><div className="panelhead"><h2>Loan closed</h2><FileCheck2 size={21}/></div><p>All scheduled obligations for this simulated loan are settled.</p><Link className="textlink tooljump" href={base+'/'+id+'/certificate'}>View closure certificate <ArrowRight size={16}/></Link></section>}
 <div className="servicing-layout"><section className="panel schedule-panel"><div className="service-tabs" role="group" aria-label="Loan records">{(['schedule','history','charges'] as const).map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='schedule'?'Repayment schedule':t==='history'?'Payment history':'Late charges'}</button>)}</div>
 {tab==='schedule'?<Schedule rows={schedule}/>:tab==='history'?<Ledger transactions={transactions}/>:penalties.length?<div className="tablewrap"><table className="datatable"><thead><tr><th>Instalment</th><th>Charge</th><th>Paid</th></tr></thead><tbody>{penalties.map(p=><tr key={p.month}><td>{p.month}</td><td>{money(p.amount)}</td><td>{money(p.paid??0)}</td></tr>)}</tbody></table></div>:<Empty title="No late charges recorded"/>}</section>
 {!admin&&['active','defaulted'].includes(l.status)&&<LoanPayment key={l.id} loan={l} onReceipt={r=>{setReceipt(r);setTab('history');}}/>}</div></>;
}
export function LoansPage({admin=false,repayments=false,parts}:{admin?:boolean;repayments?:boolean;parts:string[]}){
 if(parts[0]&&parts[1]==='certificate')return <CertificatePage admin={admin} id={parts[0]}/>;
 return parts[0]?<LoanAccount admin={admin} id={parts[0]}/>:<LoanDirectory admin={admin} repayments={repayments}/>;
}
