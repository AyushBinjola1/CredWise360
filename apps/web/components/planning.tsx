'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {ArrowDownRight,ArrowUpRight,Save,Sparkles} from 'lucide-react';
import {api,date,errText,human,money,useResource} from '@/lib/api';
import {Button} from './ui/button';
import {Empty,Failure,Loading,Metric,PageHeading} from './states';
import './planning.css';
const TrendChart=dynamic(()=>import('./trend-chart'),{ssr:false});
const paise=(value:string)=>Math.round(Number(value||0)*100);
const rupees=(value:number)=>String(value/100);
type Kind='twin'|'stress'|'debt'|'education';
interface Saved{id:number;kind:Kind;name:string;created_at:string;result:Record<string,unknown>}

function Money({label,value,onChange,hint,min=0}:{label:string;value:string;onChange:(v:string)=>void;hint?:string;min?:number}){
 return <label>{label}<input type="number" inputMode="decimal" min={min} step="0.01" required value={value} onChange={e=>onChange(e.target.value)}/>{hint&&<small className="muted">{hint}</small>}</label>;
}
function SaveScenario({kind,input,disabled}:{kind:Kind;input:unknown;disabled?:boolean}){
 const cache=useQueryClient(),[name,setName]=useState(''),[done,setDone]=useState('');
 const save=useMutation({mutationFn:()=>api('planning/scenarios',{kind,name:name.trim(),input}),onSuccess:()=>{setDone('Saved to your scenarios.');setName('');cache.invalidateQueries({queryKey:['api','planning/scenarios']});}});
 return <form className="save-row no-print" onSubmit={e=>{e.preventDefault();setDone('');save.mutate();}}><label>Scenario name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="For example, Cautious plan"/></label><Button variant="outline" disabled={disabled||save.isPending||!name.trim()}><Save size={15}/>Save scenario</Button>{save.error&&<Failure message={errText(save.error)}/>}{done&&<p role="status">{done}</p>}</form>;
}
function SavedList({kind}:{kind:Kind}){
 const q=useResource<{items:Saved[]}>('planning/scenarios');
 const items=(q.data?.items||[]).filter(s=>s.kind===kind);
 return <section className="panel"><div className="panelhead"><h2>Saved scenarios</h2></div>{q.isPending?<Loading/>:!items.length?<Empty title="Nothing saved yet">Run the tool and save a scenario to compare options later.</Empty>:<div className="historylist">{items.map(s=><div key={s.id}><strong>{s.name}</strong><span>{date(s.created_at)}</span></div>)}</div>}</section>;
}
function Delta({value,unit=''}:{value:number|null;unit?:string}){
 if(value===null||value===0)return <span className="delta">No change</span>;
 return <span className={'delta '+(value>0?'up':'down')}>{value>0?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>}{value>0?'+':''}{value}{unit}</span>;
}

interface Summary{score:number|null;risk:string;capacity:number;strategy:string;health:number|null;disposable:number}
interface TwinResult{baseline:Summary;scenario:Summary;delta:{score:number|null;capacity:number;disposable:number};factors:{name:string;before:number|null;after:number|null}[];suggestions:string[];changes:Record<string,number>;preset:string}
interface Context{debts:{name:string;balance:number;minimum:number;rate_bps:number}[];profile:Record<string,number>;metrics:{disposable:number};education_rate_bps:number}

export function TwinPage(){
 const context=useResource<Context>('planning/context'),presets=useResource<{items:{id:string;name:string;description:string}[]}>('planning/presets');
 const [fields,setFields]=useState<Record<string,string>>({}),[active,setActive]=useState('');
 const labels:[string,string][]=[['salary','Monthly salary (₹)'],['discretionary','Optional spending (₹)'],['savings','Monthly savings (₹)'],['reserves','Emergency savings (₹)'],['debt','Outstanding debt (₹)']];
 useEffect(()=>{const p=context.data?.profile;if(p)setFields(Object.fromEntries([...labels.map(([k])=>[k,rupees(p[k])]),['utilization',String(p.utilization)],['missed',String(p.missed)]]));},[context.data]);// eslint-disable-line react-hooks/exhaustive-deps
 const run=useMutation({mutationFn:(body:object)=>api<TwinResult>('planning/twin',body)});
 if(context.isPending)return <Loading/>;if(context.error)return <Failure message={context.error.message} retry={()=>context.refetch()}/>;
 const p=context.data.profile;
 const changes=()=>{const out:Record<string,number>={};for(const [k] of labels)if(paise(fields[k])!==p[k])out[k]=paise(fields[k]);for(const k of ['utilization','missed'])if(Number(fields[k])!==p[k])out[k]=Number(fields[k]);return out;};
 const r=run.data;
 return <><PageHeading kicker="Planning" title="Credit score digital twin" description="Test a change on a copy of your profile. Your saved records and score stay as they are."/>
 <section className="panel"><div className="panelhead"><h2>Try a ready-made scenario</h2><Sparkles size={18}/></div><div className="preset-grid">{presets.data?.items.map(x=><button key={x.id} type="button" className="preset" aria-pressed={active===x.id} onClick={()=>{setActive(x.id);run.mutate({preset:x.id});}}><strong>{x.name}</strong><small>{x.description}</small></button>)}</div></section>
 <form className="panel formstack" onSubmit={e=>{e.preventDefault();setActive('');run.mutate({changes:changes()});}}><div className="panelhead"><h2>Or change your own numbers</h2></div><div className="controlgrid">{labels.map(([k,l])=><Money key={k} label={l} value={fields[k]??''} onChange={v=>setFields({...fields,[k]:v})}/>)}<label>Credit utilization (%)<input type="number" min={0} max={100} required value={fields.utilization??''} onChange={e=>setFields({...fields,utilization:e.target.value})}/></label><label>Missed payments<input type="number" min={0} required value={fields.missed??''} onChange={e=>setFields({...fields,missed:e.target.value})}/></label></div><div><Button disabled={run.isPending}>Simulate</Button></div></form>
 {run.error&&<Failure message={errText(run.error)}/>}
 {run.isPending&&<Loading/>}
 {r&&<><section className="compare-pair"><div className="panel"><span className="eyebrow">Today</span><h2>{r.baseline.score??'More evidence needed'}</h2><p>{human(r.baseline.risk)} risk · room for a new EMI {money(r.baseline.capacity)}</p></div><div className="panel highlight"><span className="eyebrow">Scenario</span><h2>{r.scenario.score??'More evidence needed'} <Delta value={r.delta.score} unit=" points"/></h2><p>{human(r.scenario.risk)} risk · room for a new EMI {money(r.scenario.capacity)}</p></div></section>
 <div className="metricgrid"><Metric label="Change in monthly EMI room" value={money(r.delta.capacity)}/><Metric label="Change in monthly disposable income" value={money(r.delta.disposable)}/><Metric label="Financial health" value={r.scenario.health==null?'Add income':r.scenario.health+' / 100'} detail={'Today '+(r.baseline.health??'–')}/></div>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>What moved the score</h2></div><div className="tablewrap"><table className="datatable"><thead><tr><th scope="col">Factor</th><th scope="col">Today</th><th scope="col">Scenario</th></tr></thead><tbody>{r.factors.map(f=><tr key={f.name}><th scope="row">{f.name}</th><td>{f.before??'–'}</td><td>{f.after??'–'}</td></tr>)}</tbody></table></div></section><section className="panel"><div className="panelhead"><h2>Next steps</h2></div><ul className="prose-list">{r.suggestions.map(s=><li key={s}>{s}</li>)}</ul></section></div>
 <SaveScenario kind="twin" input={{preset:r.preset||undefined,changes:r.changes}}/></>}
 <SavedList kind="twin"/></>;
}

interface DebtResult{strategy:string;months:number;total_interest:number;total_debt:number;monthly_budget:number;minimum_total:number;payoff_order:{name:string;month:number}[];series:{month:number;balance:number}[];baseline:{months:number|null;total_interest:number;finished:boolean};months_saved:number|null;interest_saved:number|null}
interface ManualDebt{name:string;balance:string;rate:string;minimum:string}
export function DebtPage(){
 const context=useResource<Context>('planning/context');
 const [manual,setManual]=useState<ManualDebt[]>([]),[budget,setBudget]=useState(''),[strategy,setStrategy]=useState<'avalanche'|'snowball'>('avalanche');
 const body=(s:string)=>({strategy:s,monthly_budget:paise(budget),extra_debts:manual.filter(d=>d.name.trim()).map(d=>({name:d.name.trim(),balance:paise(d.balance),minimum:paise(d.minimum),rate_bps:Math.round(Number(d.rate||0)*100)}))});
 const run=useMutation({mutationFn:async()=>{const [a,s]=await Promise.all([api<DebtResult>('planning/debt',body('avalanche')),api<DebtResult>('planning/debt',body('snowball'))]);return {a,s};}});
 if(context.isPending)return <Loading/>;if(context.error)return <Failure message={context.error.message}/>;
 const minimum=context.data.debts.reduce((t,d)=>t+d.minimum,0)+manual.reduce((t,d)=>t+paise(d.minimum),0);
 const chosen=run.data?(strategy==='avalanche'?run.data.a:run.data.s):null;
 const update=(i:number,patch:Partial<ManualDebt>)=>setManual(manual.map((d,j)=>j===i?{...d,...patch}:d));
 return <><PageHeading kicker="Planning" title="Debt freedom navigator" description="Compare the avalanche and snowball methods using your CredWise loans and any other debts you add."/>
 <section className="panel"><div className="panelhead"><h2>Your debts</h2></div>{context.data.debts.length?<div className="tablewrap"><table className="datatable"><thead><tr><th scope="col">Debt</th><th scope="col">Balance</th><th scope="col">Rate</th><th scope="col">Minimum</th></tr></thead><tbody>{context.data.debts.map(d=><tr key={d.name}><th scope="row">{d.name}</th><td>{money(d.balance)}</td><td>{(d.rate_bps/100).toFixed(2)}%</td><td>{money(d.minimum)}</td></tr>)}</tbody></table></div>:<p>No active CredWise loans. Add other debts below.</p>}
 {manual.map((d,i)=><div className="debt-row" key={i}><label>Name<input value={d.name} onChange={e=>update(i,{name:e.target.value})} maxLength={80}/></label><Money label="Balance (₹)" value={d.balance} onChange={v=>update(i,{balance:v})}/><label>Annual rate (%)<input type="number" min={0} max={60} step="0.01" value={d.rate} onChange={e=>update(i,{rate:e.target.value})}/></label><Money label="Minimum payment (₹)" value={d.minimum} onChange={v=>update(i,{minimum:v})}/><Button type="button" variant="outline" size="small" onClick={()=>setManual(manual.filter((_,j)=>j!==i))}>Remove</Button></div>)}
 <div className="buttonrow"><Button type="button" variant="outline" size="small" disabled={manual.length>=11} onClick={()=>setManual([...manual,{name:'',balance:'',rate:'',minimum:''}])}>Add another debt</Button></div></section>
 <form className="panel formstack" onSubmit={e=>{e.preventDefault();run.mutate();}}><div className="controlgrid"><Money label="Total monthly amount for debt (₹)" value={budget} onChange={setBudget} hint={'Must cover minimums of '+money(minimum)}/></div><div><Button disabled={run.isPending||!budget}>Compare strategies</Button></div></form>
 {run.error&&<Failure message={errText(run.error)}/>}
 {run.data&&chosen&&<><div className="service-tabs" role="group" aria-label="Strategy">{(['avalanche','snowball'] as const).map(s=><button key={s} aria-pressed={strategy===s} onClick={()=>setStrategy(s)}>{human(s)}</button>)}</div>
 <div className="metricgrid"><Metric label="Debt-free in" value={chosen.months+' months'} detail={chosen.baseline.months==null?'Minimums alone never clear it':'Minimums only: '+chosen.baseline.months+' months'}/><Metric label="Total interest" value={money(chosen.total_interest)}/><Metric label="Interest saved" value={chosen.interest_saved==null?'—':money(chosen.interest_saved)} detail="Against paying only minimums"/><Metric label="Months saved" value={chosen.months_saved==null?'—':chosen.months_saved}/></div>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Balance over time</h2></div><TrendChart rows={chosen.series.map(p=>({x:p.month,y:p.balance}))} label="Total debt balance"/></section><section className="panel"><div className="panelhead"><h2>Payoff order</h2></div><ol className="prose-list">{chosen.payoff_order.map(o=><li key={o.name}>{o.name} · month {o.month}</li>)}</ol><p className="muted">Avalanche: {money(run.data.a.total_interest)} interest in {run.data.a.months} months. Snowball: {money(run.data.s.total_interest)} in {run.data.s.months} months.</p></section></div>
 <SaveScenario kind="debt" input={body(strategy)}/></>}
 <SavedList kind="debt"/></>;
}

interface StressResult{level:string;shocks:Record<string,number>;normal:{income:number;surplus:number};stressed:{income:number;essential:number;optional:number;emi:number;surplus:number;emi_ratio:number|null};reserves:number;monthly_shortfall:number;runway_months:number|null;depleted_in_month:number|null;timeline:{month:number;reserves:number}[];actions:string[]}
const stressPresets:{name:string;values:[number,number,number,number]}[]=[{name:'Job loss',values:[100,0,0,6]},{name:'Medical emergency',values:[0,30,0,3]},{name:'Instalments rise',values:[0,0,25,12]},{name:'Combined shock',values:[30,20,20,6]}];
export function StressPage(){
 const [v,setV]=useState({income_drop_pct:'30',expense_rise_pct:'10',emi_rise_pct:'0',duration_months:'6'});
 const run=useMutation({mutationFn:(b:object)=>api<StressResult>('planning/stress',b)});
 const send=(x=v)=>run.mutate(Object.fromEntries(Object.entries(x).map(([k,n])=>[k,Number(n)])));
 const r=run.data;
 const tone=r?.level==='stable'?'ok':r?.level==='strained'?'warn':'bad';
 return <><PageHeading kicker="Planning" title="Financial stress test" description="See how long your reserves last if income falls or costs rise. Uses your saved profile and active loans."/>
 <section className="panel"><div className="panelhead"><h2>Start from a situation</h2></div><div className="preset-grid">{stressPresets.map(s=><button key={s.name} type="button" className="preset" onClick={()=>{const next={income_drop_pct:String(s.values[0]),expense_rise_pct:String(s.values[1]),emi_rise_pct:String(s.values[2]),duration_months:String(s.values[3])};setV(next);send(next);}}><strong>{s.name}</strong><small>Income −{s.values[0]}% · costs +{s.values[1]}% · instalments +{s.values[2]}% · {s.values[3]} months</small></button>)}</div></section>
 <form className="panel formstack" onSubmit={e=>{e.preventDefault();send();}}><div className="controlgrid">{([['income_drop_pct','Income drop (%)',100],['expense_rise_pct','Essential cost rise (%)',200],['emi_rise_pct','Instalment rise (%)',200],['duration_months','Duration (months)',60]] as const).map(([k,l,max])=><label key={k}>{l}<input type="number" min={k==='duration_months'?1:0} max={max} required value={v[k]} onChange={e=>setV({...v,[k]:e.target.value})}/></label>)}</div><div><Button disabled={run.isPending}>Run stress test</Button></div></form>
 {run.error&&<Failure message={errText(run.error)}/>}{run.isPending&&<Loading/>}
 {r&&<><section className={'panel stress-verdict '+tone}><span className="eyebrow">Result</span><h2>{r.level==='stable'?'Your finances hold up':r.level==='strained'?'Your reserves cover the shortfall':'Your reserves run out'}</h2><p>{r.monthly_shortfall>0?'Monthly shortfall '+money(r.monthly_shortfall)+(r.runway_months!==null?' · reserves last about '+r.runway_months+' months':''):'Monthly surplus '+money(r.stressed.surplus)}</p></section>
 <div className="metricgrid"><Metric label="Income in the scenario" value={money(r.stressed.income)} detail={'Normally '+money(r.normal.income)}/><Metric label="Monthly surplus" value={money(r.stressed.surplus)} detail={'Normally '+money(r.normal.surplus)}/><Metric label="Instalments to income" value={r.stressed.emi_ratio==null?'No income':r.stressed.emi_ratio+'%'}/><Metric label="Emergency savings" value={money(r.reserves)}/></div>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Reserves over time</h2></div><TrendChart rows={r.timeline.map(p=>({x:p.month,y:p.reserves}))} label="Emergency reserves"/></section><section className="panel"><div className="panelhead"><h2>What to do</h2></div><ul className="prose-list">{r.actions.map(a=><li key={a}>{a}</li>)}</ul></section></div>
 <SaveScenario kind="stress" input={Object.fromEntries(Object.entries(v).map(([k,n])=>[k,Number(n)]))}/></>}
 <SavedList kind="stress"/></>;
}

interface EduResult{loan_principal:number;moratorium_months:number;interest_accrued:number;interest_paid_during_study:number;repayment_start_balance:number;emi:number;repayment_months:number;total_repayment:number;lifetime_interest:number;salary_share_pct:number|null;verdict:string;tranches:{month:number;amount:number}[];tenure_options:{months:number;emi:number;total_interest:number;salary_share_pct:number|null}[]}
export function EducationPage(){
 const context=useResource<Context>('planning/context');
 const [v,setV]=useState({total_cost:'1500000',family:'300000',scholarship:'100000',years:'2',grace:'6',months:'84',salary:'60000',rate:'',pay:false});
 const run=useMutation({mutationFn:()=>api<EduResult>('planning/education',input())});
 function input(){return {total_cost:paise(v.total_cost),family_contribution:paise(v.family),scholarship:paise(v.scholarship),study_years:Number(v.years),grace_months:Number(v.grace),repayment_months:Number(v.months),expected_salary:paise(v.salary),pay_interest_during_study:v.pay,...(v.rate?{rate_bps:Math.round(Number(v.rate)*100)}:{})};}
 if(context.isPending)return <Loading/>;
 const set=(k:string,x:string|boolean)=>setV({...v,[k]:x});
 const r=run.data;
 return <><PageHeading kicker="Planning" title="Education loan planner" description="Estimate the borrowing, the interest that builds up while you study and the repayment that follows."/>
 <form className="panel formstack" onSubmit={e=>{e.preventDefault();run.mutate();}}><div className="controlgrid"><Money label="Total course cost (₹)" value={v.total_cost} onChange={x=>set('total_cost',x)}/><Money label="Family contribution (₹)" value={v.family} onChange={x=>set('family',x)}/><Money label="Scholarship (₹)" value={v.scholarship} onChange={x=>set('scholarship',x)}/><label>Years of study<input type="number" min={1} max={8} required value={v.years} onChange={e=>set('years',e.target.value)}/></label><label>Grace period after study (months)<input type="number" min={0} max={24} required value={v.grace} onChange={e=>set('grace',e.target.value)}/></label><label>Repayment period (months)<input type="number" min={6} max={240} required value={v.months} onChange={e=>set('months',e.target.value)}/></label><Money label="Expected monthly salary (₹)" value={v.salary} onChange={x=>set('salary',x)}/><label>Annual interest (%)<input type="number" min={0} max={60} step="0.01" placeholder={(context.data!.education_rate_bps/100).toFixed(2)} value={v.rate} onChange={e=>set('rate',e.target.value)}/><small className="muted">Leave blank to use the education product rate.</small></label></div><label className="checkrow"><input type="checkbox" checked={v.pay} onChange={e=>set('pay',e.target.checked)}/>Pay interest monthly while studying</label><div><Button disabled={run.isPending}>Project my loan</Button></div></form>
 {run.error&&<Failure message={errText(run.error)}/>}{run.isPending&&<Loading/>}
 {r&&<><section className={'panel stress-verdict '+(r.verdict==='comfortable'?'ok':r.verdict==='stretched'?'warn':r.verdict==='risky'?'bad':'ok')}><span className="eyebrow">Repayment outlook</span><h2>{r.verdict==='needs_salary'?'Add an expected salary to judge affordability':r.verdict==='comfortable'?'Comfortable repayment':r.verdict==='stretched'?'Stretched repayment':'Risky repayment'}</h2><p>EMI {money(r.emi)} for {r.repayment_months} months{r.salary_share_pct!==null?' · '+r.salary_share_pct+'% of expected salary':''}</p></section>
 <div className="metricgrid"><Metric label="Loan needed" value={money(r.loan_principal)}/><Metric label={r.interest_paid_during_study>0?'Interest paid while studying':'Interest added while studying'} value={money(r.interest_paid_during_study>0?r.interest_paid_during_study:r.interest_accrued)} detail={r.moratorium_months+' months before repayment'}/><Metric label="Balance when repayment starts" value={money(r.repayment_start_balance)}/><Metric label="Total interest over the loan" value={money(r.lifetime_interest)}/></div>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Compare repayment periods</h2></div><div className="tablewrap"><table className="datatable"><thead><tr><th scope="col">Period</th><th scope="col">EMI</th><th scope="col">Interest</th><th scope="col">Of salary</th></tr></thead><tbody>{r.tenure_options.map(o=><tr key={o.months}><th scope="row">{o.months} months</th><td>{money(o.emi)}</td><td>{money(o.total_interest)}</td><td>{o.salary_share_pct==null?'–':o.salary_share_pct+'%'}</td></tr>)}</tbody></table></div></section><section className="panel"><div className="panelhead"><h2>Disbursement plan</h2></div><div className="historylist">{r.tranches.map(t=><div key={t.month}><span>Month {t.month}</span><strong>{money(t.amount)}</strong></div>)}</div></section></div>
 <SaveScenario kind="education" input={input()}/></>}
 <SavedList kind="education"/></>;
}
