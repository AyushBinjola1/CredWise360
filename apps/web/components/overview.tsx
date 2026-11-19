'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,Banknote,ClipboardCheck,Coins,Flag,Leaf,Wallet} from 'lucide-react';
import {useResource,money,date,human} from '@/lib/api';
import {PortfolioMetrics,usePortfolio} from './operations';
import type {Assessment} from './credit';
import type {User,ProfileResult} from '@/lib/model';
import {Loading,Failure,Metric,PageHeading} from './states';
const CashChart=dynamic(()=>import('./cash-chart'),{ssr:false});
interface Dashboard{applications:{status:string;count:number}[];loans:{active:number;outstanding:number};next_payment:{loan_id:number;due_date:string;amount:number;overdue:boolean}|null;unread:number;recent:{id:number;application_id:number;status:string;action:string;note:string;created_at:string}[]}
export function Overview({user}:{user:User}){
 const result=useResource<ProfileResult>('profile'),credit=useResource<Assessment>('credit'),board=useResource<Dashboard>('dashboard');
 if(result.isPending)return <Loading/>;if(result.error)return <Failure message={result.error.message} retry={()=>result.refetch()}/>;
 const {effective_profile:p,metrics:m}=result.data;
 return <><PageHeading kicker="Borrower workspace" title={'Hello, '+user.name.split(' ')[0]+'.'} description="Here’s where your finances stand today."/>
 <section className="balance"><div><span className="eyebrow"><i/> Monthly disposable income</span><strong>{money(m.disposable)}</strong><p>Income available after monthly spending and EMI commitments.</p><Link href="/app/profile">View financial profile <ArrowUpRight size={16}/></Link></div><div className="balance-glyph" aria-hidden><Leaf size={98} strokeWidth={.75}/></div></section>
 <div className="metricgrid"><Metric label="Monthly income" value={money(m.income)}/><Metric label="EMI-to-income" value={m.emi_ratio==null?'Add income':m.emi_ratio.toFixed(1)+'%'}/><Metric label="Emergency coverage" value={m.coverage==null?'Add expenses':m.coverage.toFixed(1)+' months'}/></div>
 {board.data&&<section className="panel"><div className="panelhead"><h2>Your borrowing</h2><Banknote size={19}/></div><div className="metricgrid"><Metric label="Active loans" value={board.data.loans.active} detail={'Outstanding '+money(board.data.loans.outstanding)}/><Metric label="Next payment" value={board.data.next_payment?money(board.data.next_payment.amount):'Nothing due'} detail={board.data.next_payment?(board.data.next_payment.overdue?'Overdue since ':'Due ')+date(board.data.next_payment.due_date):undefined}/><Metric label="Applications" value={board.data.applications.reduce((t,a)=>t+a.count,0)} detail={board.data.applications.map(a=>a.count+' '+human(a.status).toLowerCase()).join(' · ')||'None yet'}/><Metric label="Unread notifications" value={board.data.unread}/></div>
 {board.data.next_payment&&<Link className="actionrow" href={'/app/loans/'+board.data.next_payment.loan_id+'#make-payment'}><Banknote size={21}/><span><strong>Make your next payment</strong><small>Loan {board.data.next_payment.loan_id}</small></span><ArrowRight size={16}/></Link>}
 {board.data.recent.map(e=><div className="actionrow" key={e.id}><ClipboardCheck size={20}/><span><strong>Application {e.application_id} · {human(e.action)}</strong><small>{e.note||human(e.status)} · {date(e.created_at)}</small></span></div>)}</section>}
 {credit.data&&<div className="panel"><Link className="actionrow" href="/app/credit"><Leaf size={22}/><span><strong>Simulated credit score · {credit.data.score??'More evidence needed'}</strong><small>See your assessment factors and improvement suggestions.</small></span><ArrowRight size={16}/></Link></div>}
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Monthly cash flow</h2><Wallet size={19}/></div><CashChart rows={[{name:'Income',amount:m.income},{name:'Essentials',amount:p.essential},{name:'Optional',amount:p.discretionary},{name:'EMIs',amount:p.existing_emi},{name:'Savings',amount:p.savings}]}/></section>
 <section className="panel"><div className="panelhead"><h2>Your next steps</h2><Coins size={19}/></div><Link className="actionrow" href="/app/profile"><Wallet size={21}/><span><strong>Review your budget</strong><small>Keep your income and spending up to date.</small></span><ArrowRight size={16}/></Link><Link className="actionrow" href="/app/loans"><Wallet size={21}/><span><strong>Manage your loans</strong><small>View due dates, balances and payment history.</small></span><ArrowRight size={16}/></Link><Link className="actionrow" href="/app/kyc"><ClipboardCheck size={21}/><span><strong>Check your KYC status</strong><small>Review your simulated identity record.</small></span><ArrowRight size={16}/></Link></section></div></>;
}
export function AdminOverview(){
 const q=usePortfolio();
 return <><PageHeading kicker="Administrator workspace" title="Executive overview" description="Live figures from applications, the loan ledger, identity reviews and fraud screening."/>
 {q.isPending?<Loading/>:q.error?<Failure message={q.error.message} retry={()=>q.refetch()}/>:<><PortfolioMetrics t={q.data.totals}/><div className="metricgrid"><Metric label="KYC reviews waiting" value={q.data.totals.kyc_pending}/><Metric label="Open fraud cases" value={q.data.totals.fraud_open}/></div></>}
 <div className="panel"><Link className="actionrow" href="/admin/applications"><ClipboardCheck/><span><strong>Underwriting queue</strong><small>Review submitted applications and supporting documents.</small></span><ArrowRight size={16}/></Link><Link className="actionrow" href="/admin/repayments"><Wallet/><span><strong>Repayment monitoring</strong><small>Follow collections and overdue instalments.</small></span><ArrowRight size={16}/></Link><Link className="actionrow" href="/admin/fraud"><Flag/><span><strong>Fraud review</strong><small>Investigate rule-based alerts.</small></span><ArrowRight size={16}/></Link><Link className="actionrow" href="/admin/kyc"><ClipboardCheck/><span><strong>Identity review queue</strong><small>Review submitted synthetic documents.</small></span><ArrowRight size={16}/></Link></div></>;
}
