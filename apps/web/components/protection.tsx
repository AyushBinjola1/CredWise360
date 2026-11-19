'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {AlertTriangle,CheckCircle2,CircleHelp,Info,ShieldAlert,XCircle} from 'lucide-react';
import {api,date,errText,human,money,useResource} from '@/lib/api';
import {Button} from './ui/button';
import {Empty,Failure,Loading,Metric,PageHeading} from './states';
import './planning.css';
import './oversight.css';

const paise=(v:string)=>Math.round(Number(v)*100);
const optional=(v:string,scale:number)=>v.trim()===''?undefined:Math.round(Number(v)*scale);

interface Flag{code:string;severity:'info'|'warn'|'high';title:string;detail:string}
interface Scan{verdict:string;flags:Flag[];checklist:{item:string;status:'pass'|'fail'|'unknown';detail:string}[];advice:string[];disclaimer:string;
 facts:{net_disbursed:number;total_repayment:number;total_cost:number;effective_annual_pct:number;advertised_rate_pct:number;payment:number;calculated_payment:number;payments_per_year:number;periods:number;income_share_pct:number|null;upfront_share_pct:number}}
const blank={principal:'50000',months:'12',rate:'18',basis:'flat',frequency:'monthly',fee:'5000',charges:'3000',stated:'',late:'',prepay:'',lock:'',useIncome:true};
const example={principal:'50000',months:'12',rate:'18',basis:'flat',frequency:'monthly',fee:'5000',charges:'3000',stated:'5200',late:'2000',prepay:'6',lock:'18',useIncome:true};
const verdictText:Record<string,[string,string]>={no_major_concerns:['No major concerns found','ok'],caution:['Proceed with caution','warn'],high_concern:['High concern','bad']};
const SeverityIcon=({s}:{s:Flag['severity']})=>s==='high'?<ShieldAlert size={18} aria-hidden/>:s==='warn'?<AlertTriangle size={18} aria-hidden/>:<Info size={18} aria-hidden/>;
const CheckIcon=({s}:{s:string})=>s==='pass'?<CheckCircle2 size={17} aria-hidden className="ck-pass"/>:s==='fail'?<XCircle size={17} aria-hidden className="ck-fail"/>:<CircleHelp size={17} aria-hidden className="ck-unknown"/>;

export function SafetyPage(){
 const [v,setV]=useState(blank);
 const set=(k:string,x:string|boolean)=>setV({...v,[k]:x});
 const scan=useMutation({mutationFn:()=>api<Scan>('safety/scan',{principal:paise(v.principal),months:Number(v.months),advertised_rate_bps:Math.round(Number(v.rate)*100),basis:v.basis,frequency:v.frequency,
  processing_fee:paise(v.fee||'0'),mandatory_charges:paise(v.charges||'0'),stated_payment:optional(v.stated,100),late_fee:optional(v.late,100),prepayment_penalty_bps:optional(v.prepay,100),lock_in_months:optional(v.lock,1),use_profile_income:v.useIncome})});
 const r=scan.data,[label,tone]=r?verdictText[r.verdict]:['',''];
 return <><PageHeading kicker="Borrower protection" title="Loan safety scanner" description="Enter an offer you have received from any lender to see what it would really cost. Nothing you enter here is saved."/>
 <form className="panel formstack" onSubmit={e=>{e.preventDefault();scan.mutate();}}>
  <div className="panelhead"><h2>The offer</h2><Button type="button" variant="outline" size="small" onClick={()=>{setV(example);scan.reset();}}>Load an example offer</Button></div>
  <div className="controlgrid">
   <label>Loan amount (₹)<input type="number" min="1" step="0.01" required value={v.principal} onChange={e=>set('principal',e.target.value)}/></label>
   <label>Term (months)<input type="number" min="1" max="600" required value={v.months} onChange={e=>set('months',e.target.value)}/></label>
   <label>Advertised interest (% a year)<input type="number" min="0" max="300" step="0.01" required value={v.rate} onChange={e=>set('rate',e.target.value)}/></label>
   <label>How interest is charged<select value={v.basis} onChange={e=>set('basis',e.target.value)}><option value="reducing">Reducing balance</option><option value="flat">Flat on the original amount</option></select></label>
   <label>Repayment frequency<select value={v.frequency} onChange={e=>set('frequency',e.target.value)}><option value="monthly">Monthly</option><option value="biweekly">Every two weeks</option><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>
   <label>Processing fee (₹)<input type="number" min="0" step="0.01" value={v.fee} onChange={e=>set('fee',e.target.value)}/></label>
   <label>Mandatory charges such as insurance (₹)<input type="number" min="0" step="0.01" value={v.charges} onChange={e=>set('charges',e.target.value)}/></label>
   <label>Repayment the lender quotes, per payment (₹)<input type="number" min="0" step="0.01" value={v.stated} onChange={e=>set('stated',e.target.value)}/><small className="muted">Optional. We compare it with the advertised terms.</small></label>
   <label>Late fee per missed payment (₹)<input type="number" min="0" step="0.01" value={v.late} onChange={e=>set('late',e.target.value)}/><small className="muted">Leave blank if the lender has not said.</small></label>
   <label>Prepayment penalty (%)<input type="number" min="0" max="50" step="0.01" value={v.prepay} onChange={e=>set('prepay',e.target.value)}/></label>
   <label>Lock-in period (months)<input type="number" min="0" value={v.lock} onChange={e=>set('lock',e.target.value)}/></label>
  </div>
  <label className="checkrow"><input type="checkbox" checked={v.useIncome} onChange={e=>set('useIncome',e.target.checked)}/>Compare repayments with the income in my financial profile</label>
  <div><Button disabled={scan.isPending}>{scan.isPending?'Scanning…':'Scan this offer'}</Button></div>
 </form>
 {scan.error&&<Failure message={errText(scan.error)}/>}
 {r&&<><section className={'panel verdict '+tone} role="status"><span className="eyebrow">Result</span><h2>{label}</h2><p>The effective annual cost is <strong>{r.facts.effective_annual_pct}%</strong>, compared with the {r.facts.advertised_rate_pct}% advertised.</p></section>
 <div className="metricgrid"><Metric label="You actually receive" value={money(r.facts.net_disbursed)} detail={r.facts.upfront_share_pct+'% deducted upfront'}/><Metric label="Total you repay" value={money(r.facts.total_repayment)} detail={r.facts.periods+' payments of '+money(r.facts.payment)}/><Metric label="Total cost of borrowing" value={money(r.facts.total_cost)}/><Metric label="Share of your income" value={r.facts.income_share_pct==null?'Not checked':r.facts.income_share_pct+'%'} detail="Monthly equivalent of repayments"/></div>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Warning signs</h2></div>{!r.flags.length?<Empty title="No warning signs found">The terms you entered look consistent.</Empty>:<ul className="flag-list">{r.flags.map(f=><li key={f.code} className={'flag '+f.severity}><SeverityIcon s={f.severity}/><div><strong>{f.title}</strong><span className="sr-only"> ({f.severity==='high'?'high concern':f.severity==='warn'?'caution':'for information'})</span><p>{f.detail}</p></div></li>)}</ul>}</section>
 <section className="panel"><div className="panelhead"><h2>Safe-borrowing checklist</h2></div><ul className="check-list">{r.checklist.map(c=><li key={c.item}><CheckIcon s={c.status}/><div><strong>{c.item}</strong><span className="sr-only"> — {c.status==='pass'?'passed':c.status==='fail'?'needs attention':'not known'}</span><p>{c.detail}</p></div></li>)}</ul></section></div>
 <section className="panel"><div className="panelhead"><h2>Before you sign</h2></div><ul className="prose-list">{r.advice.map(a=><li key={a}>{a}</li>)}</ul><p className="muted">{r.disclaimer}</p><Link className="textlink" href="/app/market">Compare a CredWise product instead</Link></section></>}</>;
}

interface Indicator{key:string;title:string;level:'ok'|'watch'|'alert';detail:string;action:string}
interface Distress{level:string;score:number;indicators:Indicator[];recommendations:string[];notice:string;insufficient_data:boolean;support?:{outreach:string;note:string}}
const levelCopy:Record<string,[string,string]>={low:['Your finances look steady','ok'],watch:['A few things to keep an eye on','warn'],elevated:['Your finances need attention','warn'],high:['Please consider getting support','bad']};
const outreachCopy:Record<string,string>={none:'No outreach yet',contacted:'Our team has offered support',plan_agreed:'A support plan was agreed',resolved:'Marked as resolved'};
export function DistressPage(){
 const q=useResource<Distress>('distress');
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const d=q.data,[title,tone]=levelCopy[d.level];
 return <><PageHeading kicker="Wellbeing" title="Financial wellbeing check" description="Early signs of repayment pressure, explained in plain language, with steps you can take."/>
 <section className={'panel verdict '+tone} role="status"><span className="eyebrow">Today’s check</span><h2>{title}</h2><p>{d.notice}</p>{d.insufficient_data&&<p>Add your income and spending in your financial profile for a fuller picture.</p>}</section>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>What we looked at</h2></div><ul className="flag-list">{d.indicators.map(i=><li key={i.key} className={'flag '+(i.level==='alert'?'high':i.level==='watch'?'warn':'info')}>{i.level==='ok'?<CheckCircle2 size={18} aria-hidden/>:<SeverityIcon s={i.level==='alert'?'high':'warn'}/>}<div><strong>{i.title}</strong><span className="pill">{i.level==='ok'?'Healthy':i.level==='watch'?'Watch':'Needs attention'}</span><p>{i.detail}</p></div></li>)}</ul></section>
 <div><section className="panel"><div className="panelhead"><h2>What you can do</h2></div><ul className="prose-list">{d.recommendations.map(r=><li key={r}>{r}</li>)}</ul><div className="buttonrow"><Link className="textlink" href="/app/stress">Run a stress test</Link><Link className="textlink" href="/app/debt">Plan debt repayment</Link></div></section>
 <section className="panel"><div className="panelhead"><h2>Talk to a person</h2></div><p>{outreachCopy[d.support?.outreach||'none']}{d.support?.note?': '+d.support.note:''}</p><Link className="textlink" href="/app/disputes">Open a support request</Link></section></div></div></>;
}

interface Case{user_id:number;name:string;email:string;level:string;score:number;indicators:Indicator[];outreach:string;note:string;updated_at:string}
function CaseRow({c}:{c:Case}){
 const cache=useQueryClient(),[outreach,setOutreach]=useState(c.outreach),[note,setNote]=useState(c.note);
 const save=useMutation({mutationFn:()=>api('admin/distress/'+c.user_id,{outreach,note}),onSuccess:()=>cache.invalidateQueries({queryKey:['api','admin/distress']})});
 return <article className="panel"><div className="panelhead"><h2>{c.name}</h2><span className={'sev '+(c.level==='high'?'high':'')}>{human(c.level)} · score {c.score}</span></div><p className="muted">{c.email} · updated {date(c.updated_at)}</p>
 <ul className="flag-list">{c.indicators.filter(i=>i.level!=='ok').map(i=><li key={i.key} className={'flag '+(i.level==='alert'?'high':'warn')}><SeverityIcon s={i.level==='alert'?'high':'warn'}/><div><strong>{i.title}</strong><p>{i.detail}</p></div></li>)}</ul>
 <div className="case-actions"><label>Outreach<select value={outreach} onChange={e=>setOutreach(e.target.value)}>{Object.entries(outreachCopy).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label>Note<input value={note} maxLength={600} onChange={e=>setNote(e.target.value)} placeholder="What support was offered"/></label><Button size="small" disabled={save.isPending||(outreach!=='none'&&!note.trim())} onClick={()=>save.mutate()}>Save outreach</Button></div>{save.error&&<Failure message={errText(save.error)}/>}</article>;
}
export function AdminDistressPage(){
 const q=useResource<{items:Case[];counts:{level:string;count:number}[];notice:string}>('admin/distress');
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 return <><PageHeading kicker="Customer care" title="Distress watch" description={q.data.notice}/>
 <div className="metricgrid">{['high','elevated','watch','low'].map(l=><Metric key={l} label={human(l)} value={q.data.counts.find(c=>c.level===l)?.count??0}/>)}</div>
 {!q.data.items.length?<Empty title="No customers need outreach">Customers appear here when their repayment indicators show pressure.</Empty>:q.data.items.map(c=><CaseRow key={c.user_id+c.outreach+c.updated_at} c={c}/>)}</>;
}
