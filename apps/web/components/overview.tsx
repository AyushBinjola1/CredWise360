'use client';
import Link from 'next/link';
import {AlertTriangle,ArrowRight,Banknote,BellRing,CalendarClock,CheckCircle2,ClipboardCheck,Compass,Flag,GraduationCap,HeartPulse,PiggyBank,ShieldCheck,Sparkles,Target,TrendingDown,TrendingUp,Wallet} from 'lucide-react';
import {useResource,money,date,human} from '@/lib/api';
import {PortfolioMetrics,usePortfolio} from './operations';
import type {Assessment} from './credit';
import type {User,ProfileResult} from '@/lib/model';
import {PageHeading,Failure,Empty,Skeleton} from './states';
import {Button} from './ui/button';
import './dashboard.css';

interface Dashboard{applications:{status:string;count:number}[];loans:{active:number;outstanding:number;principal:number};next_payment:{loan_id:number;due_date:string;amount:number;overdue:boolean}|null;
 kyc_status:string|null;unread:number;alerts:{id:number;kind:string;title:string;body:string;link:string;created_at:string}[];
 transactions:{id:number;reference:string;loan_id:number;kind:string;amount:number;payment_date:string}[];
 recent:{id:number;application_id:number;status:string;action:string;note:string;created_at:string}[]}
type Tone='good'|'warn'|'bad'|'info';
interface Step{title:string;detail:string;href:string;tone:Tone;icon:typeof Wallet}

/** Ring gauge for a 0–100 value. The number is also written out, so the colour is never the only signal. */
function Ring({value,label,size=112}:{value:number|null;label:string;size?:number}){
 const pct=value===null?0:Math.max(0,Math.min(100,value));
 return <div className="ring" role="img" aria-label={value===null?label+': not enough information':label+': '+value+' out of 100'} style={{width:size,height:size,['--pct' as string]:pct+'%'}}><div><strong>{value===null?'—':value}</strong><small>/ 100</small></div></div>;
}
/** Tiny trend line for the score history. Decorative, so it is hidden from assistive technology. */
function Sparkline({values}:{values:number[]}){
 if(values.length<2)return null;
 const min=Math.min(...values),max=Math.max(...values),span=max-min||1,w=132,h=38;
 const points=values.map((v,i)=>(i/(values.length-1)*(w-6)+3).toFixed(1)+','+(h-4-((v-min)/span)*(h-8)).toFixed(1)).join(' ');
 return <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function Progress({value,label,detail}:{value:number;label:string;detail:string}){
 const pct=Math.max(0,Math.min(100,Math.round(value)));
 return <div className="goal"><div className="goal-head"><strong>{label}</strong><span>{pct}%</span></div><progress max={100} value={pct} aria-label={label}/><small>{detail}</small></div>;
}

/** Next steps come from the borrower's own records, most urgent first. */
function nextSteps(d:Dashboard|undefined,credit:Assessment|undefined,p:ProfileResult|undefined):Step[]{
 const steps:Step[]=[];
 if(!d||!p)return steps;
 const m=p.metrics,apps=Object.fromEntries(d.applications.map(a=>[a.status,a.count]));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
 if(d.next_payment){
  const due=d.next_payment.due_date.slice(0,10),days=Math.round((Date.parse(due)-Date.parse(today))/86400000);
  if(d.next_payment.overdue)steps.push({title:'Pay your overdue instalment',detail:money(d.next_payment.amount)+' was due '+date(due)+'. Paying now stops late charges building up.',href:'/app/loans/'+d.next_payment.loan_id+'#make-payment',tone:'bad',icon:AlertTriangle});
  else if(days<=7)steps.push({title:'Your next instalment is due '+(days<=0?'today':'in '+days+' day'+(days===1?'':'s')),detail:money(d.next_payment.amount)+' on '+date(due)+'.',href:'/app/loans/'+d.next_payment.loan_id+'#make-payment',tone:'warn',icon:CalendarClock});
 }
 if(d.kyc_status!=='verified')steps.push({title:d.kyc_status==='pending'?'Identity check in review':d.kyc_status==='rejected'?'Update your identity details':'Verify your identity',detail:d.kyc_status==='pending'?'A reviewer will decide shortly. You can submit loan applications once it is verified.':'Applications need a verified simulated identity.',href:'/app/kyc',tone:d.kyc_status==='rejected'?'bad':'info',icon:ShieldCheck});
 if(apps.requires_information)steps.push({title:'An underwriter needs more information',detail:'Review the request and resubmit your application.',href:'/app/applications',tone:'warn',icon:ClipboardCheck});
 if(apps.approved)steps.push({title:'You have an approved offer',detail:'Review the frozen terms before you accept or withdraw.',href:'/app/applications',tone:'info',icon:CheckCircle2});
 if(m.coverage!==null&&m.coverage<3)steps.push({title:'Build your emergency savings',detail:'Savings cover '+m.coverage.toFixed(1)+' months. Three months is a common target. Test a plan in the stress test.',href:'/app/stress',tone:'warn',icon:PiggyBank});
 const first=credit?.suggestions?.[0];
 if(first&&credit?.score!==null&&(credit?.negative_factors?.length??0)>0)steps.push({title:'Improve your simulated score',detail:first,href:'/app/twin',tone:'info',icon:Sparkles});
 if(d.loans.active>0)steps.push({title:'Plan to clear debt sooner',detail:'Compare avalanche and snowball repayment for your loans.',href:'/app/debt',tone:'info',icon:Target});
 if(d.loans.active===0&&!apps.under_review&&!apps.submitted&&d.kyc_status==='verified')steps.push({title:'Explore loan options',detail:'See which products fit your budget before you apply.',href:'/app/market',tone:'info',icon:Compass});
 if(d.unread>0)steps.push({title:d.unread+' unread notification'+(d.unread===1?'':'s'),detail:'Decisions, receipts and reminders are waiting.',href:'/app/notifications',tone:'info',icon:BellRing});
 return steps.slice(0,4);
}

const kindLabel:Record<string,string>={disbursement:'Disbursement',emi:'EMI payment',partial:'Part payment',advance:'Advance payment',prepayment:'Prepayment',foreclosure:'Full settlement'};

export function Overview({user}:{user:User}){
 const profile=useResource<ProfileResult>('profile'),credit=useResource<Assessment>('credit'),board=useResource<Dashboard>('dashboard');
 const first=user.name.split(' ')[0];
 if(profile.error)return <><PageHeading kicker="Borrower workspace" title={'Hello, '+first+'.'}/><Failure message={profile.error.message} retry={()=>profile.refetch()}/></>;
 const p=profile.data,m=p?.metrics,e=p?.effective_profile,c=credit.data,d=board.data;
 const steps=nextSteps(d,c,p);
 const history=(c?.history||[]).map(h=>h.score).filter((s):s is number=>typeof s==='number').slice(-12);
 const goal=e&&e.goal_amount>0?Math.min(100,e.reserves/e.goal_amount*100):null;
 const repaid=d&&d.loans.principal>0?(d.loans.principal-d.loans.outstanding)/d.loans.principal*100:null;
 return <>
 <PageHeading kicker="Borrower workspace" title={'Hello, '+first+'.'} description="Your finances at a glance, with the next best steps based on your own records." action={<div className="buttonrow"><Button asChild><Link href="/app/market">Explore loans<ArrowRight size={16}/></Link></Button><Button asChild variant="outline"><Link href="/app/twin">Run a simulation</Link></Button></div>}/>
 <div className="dash-hero">
  <section className="dash-card hero-health" aria-labelledby="health-title">
   {!m?<Skeleton height={140}/>:<>
   <Ring value={m.health} label="Financial health score"/>
   <div className="hero-copy"><span className="eyebrow"><i/> Financial health</span><h2 id="health-title">{m.health===null?'Add your income to see your score':m.health>=75?'Strong footing':m.health>=50?'Steady, with room to grow':'Needs attention'}</h2>
    <p><strong className="money">{money(m.disposable)}</strong> left each month after spending and instalments.</p>
    <Link className="textlink" href="/app/profile">View financial profile <ArrowRight size={14}/></Link>
    <dl className="mini-ratios"><div><dt>Savings rate</dt><dd>{m.savings_rate==null?'—':m.savings_rate.toFixed(1)+'%'}</dd></div><div><dt>EMI to income</dt><dd>{m.emi_ratio==null?'—':m.emi_ratio.toFixed(1)+'%'}</dd></div><div><dt>Emergency cover</dt><dd>{m.coverage==null?'—':m.coverage.toFixed(1)+' mo'}</dd></div></dl>
   </div></>}
  </section>
  <section className="dash-card hero-credit" aria-labelledby="score-title">
   {!c?<Skeleton height={140}/>:<>
   <span className="eyebrow"><i/> Simulated credit score</span>
   <div className="score-line"><strong id="score-title" className="score-number">{c.score??'—'}</strong><span className="muted">/ 900</span>{c.change!==null&&c.change!==0&&<span className={'delta '+(c.change>0?'up':'down')}>{c.change>0?<TrendingUp size={15} aria-hidden/>:<TrendingDown size={15} aria-hidden/>}<span>{c.change>0?'+':''}{c.change} points</span></span>}</div>
   <p className="muted">{c.score===null?'More evidence is needed for a score.':human(c.risk)+' risk · '+human(c.strategy||'conventional')+' assessment'}</p>
   <div className="score-foot"><Sparkline values={history}/><Link className="textlink" href="/app/credit">See what shapes it <ArrowRight size={14}/></Link></div></>}
  </section>
 </div>
 <div className="kpi-row">
  <Kpi icon={Banknote} label="Outstanding debt" value={d?money(d.loans.outstanding):undefined} detail={d?d.loans.active+' active loan'+(d.loans.active===1?'':'s'):undefined}/>
  <Kpi icon={CalendarClock} label="Next EMI" value={d?(d.next_payment?money(d.next_payment.amount):'Nothing due'):undefined} detail={d?.next_payment?(d.next_payment.overdue?'Overdue since ':'Due ')+date(d.next_payment.due_date):undefined} tone={d?.next_payment?.overdue?'bad':undefined}/>
  <Kpi icon={Wallet} label="Room for a new EMI" value={c?money(c.capacity):undefined} detail="Based on your budget"/>
  <Kpi icon={ClipboardCheck} label="Applications" value={d?String(d.applications.reduce((t,a)=>t+a.count,0)):undefined} detail={d?(d.applications.filter(a=>['submitted','under_review','requires_information','approved'].includes(a.status)).reduce((t,a)=>t+a.count,0)+' in progress'):undefined}/>
 </div>
 <div className="dash-two">
  <section className="dash-card" aria-labelledby="steps-title"><div className="panelhead"><h2 id="steps-title">Recommended next steps</h2><Sparkles size={18} aria-hidden/></div>
   {!d||!p?<Skeleton height={190}/>:steps.length===0?<Empty title="You are all caught up">Nothing needs your attention right now.</Empty>:
   <ul className="steps">{steps.map(s=>{const Icon=s.icon;return <li key={s.title}><Link href={s.href} className={'step '+s.tone}><span className="step-icon"><Icon size={18} aria-hidden/></span><span><strong>{s.title}</strong><small>{s.detail}</small></span><ArrowRight size={16} aria-hidden/></Link></li>;})}</ul>}
  </section>
  <section className="dash-card" aria-labelledby="activity-title"><div className="panelhead"><h2 id="activity-title">Recent activity</h2><Link className="textlink" href="/app/reports">All reports</Link></div>
   {!d?<Skeleton height={190}/>:(d.transactions.length+d.recent.length)===0?<Empty title="No activity yet">Payments and application updates appear here.</Empty>:<>
   {d.transactions.length>0&&<ul className="feed" aria-label="Recent transactions">{d.transactions.map(t=><li key={t.id}><span className="feed-icon"><Banknote size={16} aria-hidden/></span><span><strong>{kindLabel[t.kind]||human(t.kind)}</strong><small>{t.reference} · {date(t.payment_date)}</small></span><b className="money">{t.kind==='disbursement'?'+':'−'}{money(t.amount)}</b></li>)}</ul>}
   {d.recent.length>0&&<ul className="feed" aria-label="Application updates">{d.recent.slice(0,3).map(r=><li key={r.id}><span className="feed-icon"><ClipboardCheck size={16} aria-hidden/></span><span><strong>Application {r.application_id} · {human(r.action)}</strong><small>{date(r.created_at)}</small></span></li>)}</ul>}</>}
  </section>
 </div>
 <div className="dash-two">
  <section className="dash-card" aria-labelledby="goals-title"><div className="panelhead"><h2 id="goals-title">Goals and progress</h2><Target size={18} aria-hidden/></div>
   {!e||!d?<Skeleton height={150}/>:<div className="goals">
    {goal!==null?<Progress value={goal} label={e.goal||'Savings goal'} detail={money(e.reserves)+' of '+money(e.goal_amount)}/>:<p className="muted">Set a savings goal in your <Link className="textlink" href="/app/profile">financial profile</Link> to track it here.</p>}
    {repaid!==null?<Progress value={repaid} label="Debt-free progress" detail={money(d.loans.principal-d.loans.outstanding)+' repaid of '+money(d.loans.principal)}/>:<p className="muted">You have no active loans, so there is no debt to clear.</p>}
    <Link className="textlink" href="/app/debt">Open the debt freedom navigator <ArrowRight size={14}/></Link></div>}
  </section>
  <section className="dash-card" aria-labelledby="flow-title"><div className="panelhead"><h2 id="flow-title">Monthly cash flow</h2><Wallet size={18} aria-hidden/></div>
   {!e||!m?<Skeleton height={210}/>:<MoneyBars rows={[{label:'Income',amount:m.income},{label:'Essentials',amount:e.essential},{label:'Optional spending',amount:e.discretionary},{label:'Instalments',amount:e.existing_emi},{label:'Savings',amount:e.savings}]}/>}
  </section>
 </div>
 {d&&d.alerts.length>0&&<section className="dash-card" aria-labelledby="alerts-title"><div className="panelhead"><h2 id="alerts-title">Unread notifications</h2><Link className="textlink" href="/app/notifications">All notifications</Link></div><ul className="feed">{d.alerts.map(a=><li key={a.id}><span className="feed-icon"><HeartPulse size={16} aria-hidden/></span><span><strong>{a.title}</strong><small>{a.body}</small></span>{a.link&&<Link className="textlink" href={a.link}>Open</Link>}</li>)}</ul></section>}
 <p className="muted fine"><GraduationCap size={14} aria-hidden/> Everything here is simulated educational data. <Link className="textlink" href="/app/academy">Learn how credit works</Link></p>
 </>;
}

function Kpi({icon:Icon,label,value,detail,tone}:{icon:typeof Wallet;label:string;value?:string;detail?:string;tone?:Tone}){
 return <div className={'kpi'+(tone?' '+tone:'')}><span className="kpi-icon"><Icon size={18} aria-hidden/></span><span className="kpi-label">{label}</span>{value===undefined?<Skeleton height={30} width="70%"/>:<strong className="money">{value}</strong>}{detail&&<small>{detail}</small>}</div>;
}

const Need=({label,count,href,tone}:{label:string;count:number;href:string;tone:Tone})=><li><Link href={href} className={'need '+(count>0?tone:'good')}><span className="need-count">{count}</span><span>{label}</span><ArrowRight size={15} aria-hidden/></Link></li>;

export function AdminOverview(){
 const q=usePortfolio();
 const t=q.data?.totals;
 return <><PageHeading kicker="Administrator workspace" title="Executive overview" description="Live figures from applications, the loan ledger, identity reviews and risk monitoring."/>
 {q.error&&<Failure message={q.error.message} retry={()=>q.refetch()}/>}
 {!q.error&&<>
 <section className="dash-card" aria-labelledby="attention-title"><div className="panelhead"><h2 id="attention-title">Needs attention</h2><Flag size={18} aria-hidden/></div>
  {!t?<Skeleton className="sk-needs"/>:<ul className="needs">
   <Need label="Applications in underwriting" count={t.queue} href="/admin/applications" tone="info"/>
   <Need label="Loans with overdue instalments" count={t.overdue_loans} href="/admin/repayments" tone="bad"/>
   <Need label="Open fraud cases" count={t.fraud_open} href="/admin/fraud" tone="bad"/>
   <Need label="Customers who may need support" count={t.distress_open} href="/admin/distress" tone="warn"/>
   <Need label="Open support tickets" count={t.disputes_open} href="/admin/disputes" tone="warn"/>
   <Need label="Identity reviews waiting" count={t.kyc_pending} href="/admin/kyc" tone="info"/></ul>}
 </section>
 {t?<PortfolioMetrics t={t}/>:<Skeleton className="sk-portfolio"/>}
 <div className="dash-two">
  <section className="dash-card" aria-labelledby="funnel-title"><div className="panelhead"><h2 id="funnel-title">Application pipeline</h2><Link className="textlink" href="/admin/reports">Portfolio reports</Link></div>
   {!q.data?<Skeleton height={180}/>:q.data.by_status.length===0?<Empty title="No applications yet"/>:<Bars rows={q.data.by_status.map(s=>({label:human(s.status),value:s.count}))}/>}
  </section>
  <section className="dash-card" aria-labelledby="risk-title"><div className="panelhead"><h2 id="risk-title">Borrower risk bands</h2><Link className="textlink" href="/admin/fairness">Fairness monitor</Link></div>
   {!q.data?<Skeleton height={180}/>:q.data.risk_bands.length===0?<Empty title="No assessments yet"/>:<Bars rows={q.data.risk_bands.map(s=>({label:human(s.risk),value:s.count,tone:s.risk==='high'?'bad':s.risk==='moderate'||s.risk==='human_review'?'warn':'good'}))}/>}
  </section>
 </div></>}
 </>;
}

/** Money bars scaled to the largest value. Lighter than a chart library, and every figure is printed. */
function MoneyBars({rows}:{rows:{label:string;amount:number}[]}){
 const max=Math.max(1,...rows.map(r=>r.amount));
 return <ul className="bars money-bars" aria-label="Monthly cash flow">{rows.map((r,i)=><li key={r.label}><span>{r.label}</span><span className={'bar '+(i===0?'good':'info')} aria-hidden><i style={{width:Math.max(r.amount>0?3:0,r.amount/max*100)+'%'}}/></span><b className="money">{money(r.amount)}</b></li>)}</ul>;
}
/** Accessible horizontal bars: every value is printed, and colour only reinforces it. */
function Bars({rows}:{rows:{label:string;value:number;tone?:Tone}[]}){
 const max=Math.max(1,...rows.map(r=>r.value));
 return <ul className="bars">{rows.map(r=><li key={r.label}><span>{r.label}</span><span className={'bar '+(r.tone||'info')} aria-hidden><i style={{width:Math.max(4,r.value/max*100)+'%'}}/></span><b>{r.value}</b></li>)}</ul>;
}
