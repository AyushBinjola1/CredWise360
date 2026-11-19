'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,ArrowRight,Award,BookOpen,CheckCircle2,Lock} from 'lucide-react';
import {api,date,errText,useResource} from '@/lib/api';
import {Button} from './ui/button';
import {Empty,Failure,Loading,Metric,PageHeading} from './states';
import './oversight.css';

type Lang='en'|'hi';
function useLang():[Lang,(l:Lang)=>void]{
 const [lang,set]=useState<Lang>('en');
 useEffect(()=>{try{const saved=localStorage.getItem('cw-lang');if(saved==='hi'||saved==='en')set(saved);}catch{/* The default language is used when storage is unavailable. */}},[]);
 return [lang,l=>{set(l);try{localStorage.setItem('cw-lang',l);}catch{/* Preference is session-only without storage. */}}];
}
function LangToggle({lang,onChange}:{lang:Lang;onChange:(l:Lang)=>void}){
 return <div className="lang-toggle" role="group" aria-label="Lesson language"><button type="button" lang="en" aria-pressed={lang==='en'} onClick={()=>onChange('en')}>English</button><button type="button" lang="hi" aria-pressed={lang==='hi'} onClick={()=>onChange('hi')}>हिन्दी</button></div>;
}
interface List{items:{slug:string;title:string;completed:boolean;attempts:number}[];progress:{completed:number;total:number;percent:number}}
interface Lesson{slug:string;title:string;lesson:string;question:string;choices:string[];attempts:number;completed:boolean}
interface Answer{correct:boolean;correct_choice:number;explanation:string}

function LessonView({slug,lang,onLang}:{slug:string;lang:Lang;onLang:(l:Lang)=>void}){
 const q=useResource<Lesson>('academy/'+slug+'?lang='+lang),list=useResource<List>('academy?lang='+lang),cache=useQueryClient();
 const [choice,setChoice]=useState<number|null>(null),[result,setResult]=useState<Answer|null>(null);
 useEffect(()=>{setChoice(null);setResult(null);},[slug,lang]);
 const submit=useMutation({mutationFn:()=>api<Answer>('academy/'+slug+'/answer',{choice,lang}),onSuccess:r=>{setResult(r);cache.invalidateQueries({queryKey:['api']});}});
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const l=q.data,items=list.data?.items||[],index=items.findIndex(i=>i.slug===slug),next=items[index+1];
 return <><Link className="textlink" href="/app/academy"><ArrowLeft size={15}/> All lessons</Link>
 <PageHeading kicker={'Lesson '+(index+1)+' of '+(items.length||11)} title={l.title} action={<LangToggle lang={lang} onChange={onLang}/>}/>
 <article className="panel" lang={lang}><div className="panelhead"><h2>{lang==='hi'?'पाठ':'The idea'}</h2><BookOpen size={18} aria-hidden/></div><p>{l.lesson}</p></article>
 <form className="panel formstack" lang={lang} onSubmit={e=>{e.preventDefault();if(choice!==null)submit.mutate();}}>
  <fieldset className="formstack" disabled={submit.isPending} style={{border:0,padding:0,margin:0}}><legend><strong>{lang==='hi'?'अपनी समझ जाँचें':'Check your understanding'}</strong><p>{l.question}</p></legend>
   {l.choices.map((c,i)=><label className="choice" key={i}><input type="radio" name="answer" value={i} checked={choice===i} onChange={()=>{setChoice(i);setResult(null);}}/><span>{c}</span></label>)}</fieldset>
  <div><Button disabled={choice===null||submit.isPending}>{submit.isPending?'Checking…':lang==='hi'?'उत्तर जाँचें':'Check my answer'}</Button></div>
  {submit.error&&<Failure message={errText(submit.error)}/>}
  {result&&<div className={'panel verdict '+(result.correct?'':'warn')} role="status"><h3>{result.correct?(lang==='hi'?'सही उत्तर!':'Correct!'):(lang==='hi'?'अभी नहीं':'Not quite')}</h3>{!result.correct&&<p><strong>{lang==='hi'?'सही उत्तर: ':'Correct answer: '}</strong>{l.choices[result.correct_choice]}</p>}<p>{result.explanation}</p></div>}</form>
 <div className="buttonrow">{(l.completed||result?.correct)&&next&&<Button asChild><Link href={'/app/academy/'+next.slug}>{lang==='hi'?'अगला पाठ':'Next lesson'}<ArrowRight size={16}/></Link></Button>}{!result?.correct&&!l.completed&&result&&<Button type="button" variant="outline" onClick={()=>{setResult(null);setChoice(null);}}>{lang==='hi'?'फिर कोशिश करें':'Try again'}</Button>}</div></>;
}

export function AcademyPage({parts}:{parts:string[]}){
 const [lang,setLang]=useLang(),q=useResource<List>('academy?lang='+lang);
 if(parts[0])return <LessonView slug={parts[0]} lang={lang} onLang={setLang}/>;
 return <><PageHeading kicker="Learn" title={lang==='hi'?'वित्तीय साक्षरता अकादमी':'Financial literacy academy'} description={lang==='hi'?'छोटे पाठ, एक सवाल और सही उत्तर की व्याख्या।':'Short lessons, a quick question and a clear explanation of the right answer.'} action={<LangToggle lang={lang} onChange={setLang}/>}/>
 {q.isPending?<Loading/>:q.error?<Failure message={q.error.message} retry={()=>q.refetch()}/>:<>
 <section className="panel"><div className="panelhead"><h2>{lang==='hi'?'आपकी प्रगति':'Your progress'}</h2><Link className="textlink" href="/app/rewards">View rewards</Link></div><progress className="progressbar" aria-label="Lessons completed" value={q.data.progress.completed} max={q.data.progress.total}/><p>{q.data.progress.completed} / {q.data.progress.total} · {q.data.progress.percent}%</p></section>
 <div className="lesson-grid" lang={lang}>{q.data.items.map((i,n)=><Link key={i.slug} className="lesson-card" href={'/app/academy/'+i.slug}><span className="eyebrow">{lang==='hi'?'पाठ ':'Lesson '}{n+1}</span><strong>{i.title}</strong>{i.completed?<span className="done"><CheckCircle2 size={14} aria-hidden/> {lang==='hi'?'पूरा हुआ':'Completed'}</span>:<small className="muted">{i.attempts?(lang==='hi'?i.attempts+' प्रयास':i.attempts+' attempt(s)'):(lang==='hi'?'शुरू करें':'Not started')}</small>}</Link>)}</div></>}</>;
}

interface Rewards{points:number;level:string;next_level_at:number|null;badges:{id:string;name:string;description:string;awarded_at:string|null}[];counts:{lessons:number;on_time_instalments:number;plans:number};
 events:{kind:string;points:number;note:string;created_at:string}[];rules:string[];notice:string}
export function RewardsPage(){
 const q=useResource<Rewards>('rewards');
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const r=q.data,earned=r.badges.filter(b=>b.awarded_at).length;
 return <><PageHeading kicker="Recognition" title="Responsible rewards" description="Points and badges for learning and for managing money well."/>
 <section className="panel verdict" role="note"><span className="eyebrow">How rewards work</span><p>{r.notice}</p></section>
 <div className="metricgrid"><Metric label="Points" value={r.points}/><Metric label="Level" value={r.level} detail={r.next_level_at?(r.next_level_at-r.points)+' points to the next level':'Highest level reached'}/><Metric label="Badges earned" value={earned+' of '+r.badges.length}/><Metric label="On-time instalments" value={r.counts.on_time_instalments} detail={r.counts.lessons+' lessons completed'}/></div>
 <section className="panel"><div className="panelhead"><h2>Badges</h2><Award size={18} aria-hidden/></div><div className="badge-grid">{r.badges.map(b=><div key={b.id} className={'badge'+(b.awarded_at?'':' locked')}>{b.awarded_at?<Award size={22} aria-hidden/>:<Lock size={20} aria-hidden/>}<strong>{b.name}</strong><small className="muted">{b.description}</small><small>{b.awarded_at?'Earned '+date(b.awarded_at):'Not earned yet'}</small></div>)}</div></section>
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Recent points</h2></div>{!r.events.length?<Empty title="No points yet">Complete a lesson in the <Link className="textlink" href="/app/academy">academy</Link> to earn your first points.</Empty>:<div className="historylist">{r.events.map((e,i)=><div key={i}><span>{e.note} · {date(e.created_at)}</span><strong>+{e.points}</strong></div>)}</div>}</section>
 <section className="panel"><div className="panelhead"><h2>What earns points</h2></div><ul className="prose-list">{r.rules.map(x=><li key={x}>{x}</li>)}</ul></section></div></>;
}
