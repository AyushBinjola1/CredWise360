'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,Paperclip,Plus} from 'lucide-react';
import {api,date,errText,human,useResource} from '@/lib/api';
import {readSynthetic,saveSynthetic,type SyntheticDocument} from '@/lib/synthetic-document';
import {Button} from './ui/button';
import {Empty,Failure,Loading,PageHeading} from './states';
import './oversight.css';

const categories:Record<string,string>={incorrect_record:'Incorrect financial record',assessment_challenge:'Challenge a simulated assessment',application_reconsideration:'Ask for an application to be reconsidered',payment_issue:'Payment or loan issue',other:'Something else'};
const statuses=['open','in_review','awaiting_customer','resolved','rejected','withdrawn'];
const statusLabel=(s:string)=>s==='awaiting_customer'?'Waiting for customer':s==='in_review'?'In review':human(s);
interface Row{id:number;customer_name:string;category:string;subject:string;status:string;assignee_name:string|null;application_id:number|null;created_at:string;updated_at:string}
interface Message{id:number;author_role:'customer'|'admin';author_name:string;body:string;status:string;created_at:string;document_id:number|null;document_name:string|null}
interface Detail{ticket:Row&{description:string;resolution:string;reconsidered:boolean;customer_email:string;assignee_id:number|null};application:{id:number;status:string;tracking_id:string|null;product_name:string}|null;messages:Message[]}
const Status=({s}:{s:string})=><span className={'status-pill '+s}>{statusLabel(s)}</span>;

function FilePicker({onFile,label='Attach synthetic evidence (optional)'}:{onFile:(d:SyntheticDocument|null)=>void;label?:string}){
 const [error,setError]=useState('');
 return <label>{label}<input type="file" accept=".txt,.pdf" onChange={async e=>{setError('');const f=e.target.files?.[0];if(!f){onFile(null);return;}try{onFile(await readSynthetic(f));}catch(x){onFile(null);setError(errText(x));e.target.value='';}}}/><small className="muted">A .txt or .pdf file up to 256 KB that starts with CREDWISE-SYNTHETIC.</small>{error&&<small role="alert" className="pdf-error">{error}</small>}</label>;
}
function Download({path}:{path:string}){
 const d=useMutation({mutationFn:()=>api<SyntheticDocument>(path),onSuccess:saveSynthetic});
 return <Button type="button" variant="outline" size="small" onClick={()=>d.mutate()} disabled={d.isPending}><Paperclip size={14}/>{d.isPending?'Opening…':'Download'}</Button>;
}
function Thread({id,messages,admin}:{id:number;messages:Message[];admin:boolean}){
 return <div className="thread" role="log" aria-label="Ticket history">{messages.map(m=><article key={m.id} className={'bubble '+m.author_role}><header><strong>{m.author_role==='admin'?(admin?m.author_name:'CredWise support'):(admin?m.author_name:'You')}</strong><span>{date(m.created_at)}</span><Status s={m.status}/></header><p>{m.body}</p>{m.document_id&&<Download path={(admin?'admin/disputes/':'disputes/')+id+'/documents/'+m.document_id}/>}{m.document_name&&<small className="muted"> {m.document_name}</small>}</article>)}</div>;
}

function NewTicket({onDone}:{onDone:(id:number)=>void}){
 const apps=useResource<{items:{id:number;status:string;product_name:string;tracking_id:string|null}[]}>('applications?page_size=100');
 const [v,setV]=useState({category:'incorrect_record',subject:'',description:'',application_id:''}),[doc,setDoc]=useState<SyntheticDocument|null>(null);
 const cache=useQueryClient();
 const create=useMutation({mutationFn:()=>api<Detail>('disputes',{category:v.category,subject:v.subject.trim(),description:v.description.trim(),...(v.application_id?{application_id:Number(v.application_id)}:{}),...(doc?{document:doc}:{})}),
  onSuccess:d=>{cache.invalidateQueries({queryKey:['api','disputes']});onDone(d.ticket.id);}});
 const rejected=(apps.data?.items||[]).filter(a=>a.status==='rejected'),reconsider=v.category==='application_reconsideration';
 return <form className="panel formstack" onSubmit={e=>{e.preventDefault();create.mutate();}}><div className="panelhead"><h2>Raise a new ticket</h2></div>
 <label>What is this about?<select value={v.category} onChange={e=>setV({...v,category:e.target.value})}>{Object.entries(categories).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
 {(reconsider||v.category==='assessment_challenge'||v.category==='incorrect_record')&&<label>Related application{reconsider?'':' (optional)'}<select value={v.application_id} required={reconsider} onChange={e=>setV({...v,application_id:e.target.value})}><option value="">{reconsider?'Choose a rejected application':'None'}</option>{(reconsider?rejected:apps.data?.items||[]).map(a=><option key={a.id} value={a.id}>{a.tracking_id||'Application '+a.id} · {a.product_name} · {human(a.status)}</option>)}</select></label>}
 <label>Subject<input required minLength={3} maxLength={140} value={v.subject} onChange={e=>setV({...v,subject:e.target.value})}/></label>
 <label>Describe the issue<textarea required minLength={10} maxLength={2000} rows={5} value={v.description} onChange={e=>setV({...v,description:e.target.value})}/></label>
 <FilePicker onFile={setDoc}/>
 {create.error&&<Failure message={errText(create.error)}/>}
 <div><Button disabled={create.isPending}>{create.isPending?'Sending…':'Submit ticket'}</Button></div></form>;
}

function CustomerTicket({id}:{id:string}){
 const q=useResource<Detail>('disputes/'+id),cache=useQueryClient(),[body,setBody]=useState(''),[doc,setDoc]=useState<SyntheticDocument|null>(null),[key,setKey]=useState(0);
 const act=useMutation({mutationFn:({action,payload}:{action:string;payload?:object})=>api<Detail>('disputes/'+id+'/'+action,payload||{}),
  onSuccess:()=>{setBody('');setDoc(null);setKey(key+1);cache.invalidateQueries({queryKey:['api']});}});
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const t=q.data.ticket,closed=['resolved','rejected','withdrawn'].includes(t.status);
 return <><Link className="textlink" href="/app/disputes"><ArrowLeft size={15}/> All tickets</Link>
 <PageHeading kicker={'Ticket '+t.id+' · '+categories[t.category]} title={t.subject} description={'Opened '+date(t.created_at)+(t.assignee_name?' · Handled by '+t.assignee_name:'')} action={<Status s={t.status}/>}/>
 {q.data.application&&<p className="muted">Related application: <Link className="textlink" href={'/app/applications/'+q.data.application.id}>{q.data.application.tracking_id||q.data.application.id}</Link> · {q.data.application.product_name} · {human(q.data.application.status)}</p>}
 {t.resolution&&closed&&<section className="panel verdict"><span className="eyebrow">Resolution</span><p>{t.resolution}</p>{t.reconsidered&&<p>Your application was sent back to underwriting for a fresh review.</p>}</section>}
 <section className="panel"><div className="panelhead"><h2>History</h2></div><Thread id={t.id} messages={q.data.messages} admin={false}/></section>
 {act.error&&<Failure message={errText(act.error)}/>}
 {!closed?<form key={key} className="panel formstack" onSubmit={e=>{e.preventDefault();act.mutate({action:'messages',payload:{body:body.trim(),...(doc?{document:doc}:{})}});}}><div className="panelhead"><h2>{t.status==='awaiting_customer'?'Reply to our request':'Add information'}</h2></div><label>Message<textarea required rows={4} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/></label><FilePicker onFile={setDoc}/><div className="buttonrow"><Button disabled={act.isPending||!body.trim()}>Send</Button><Button type="button" variant="outline" disabled={act.isPending} onClick={()=>act.mutate({action:'withdraw'})}>Withdraw ticket</Button></div></form>
 :t.status!=='withdrawn'&&<form key={key} className="panel formstack" onSubmit={e=>{e.preventDefault();act.mutate({action:'reopen',payload:{body:body.trim()}});}}><div className="panelhead"><h2>Not resolved?</h2></div><label>Tell us what is still wrong<textarea required rows={3} maxLength={2000} value={body} onChange={e=>setBody(e.target.value)}/></label><div><Button disabled={act.isPending||!body.trim()}>Reopen ticket</Button></div></form>}</>;
}

export function SupportPage({parts}:{parts:string[]}){
 const [status,setStatus]=useState(''),[creating,setCreating]=useState(false);
 const q=useResource<{items:Row[]}>('disputes'+(status?'?status='+status:''));
 if(parts[0])return <CustomerTicket id={parts[0]}/>;
 return <><PageHeading kicker="Support" title="Support and disputes" description="Report a wrong record, challenge an assessment or ask for an application to be reconsidered. You can follow every reply here." action={<Button onClick={()=>setCreating(!creating)} aria-expanded={creating}><Plus size={16}/>{creating?'Close form':'New ticket'}</Button>}/>
 {creating&&<NewTicket onDone={id=>{window.location.assign('/app/disputes/'+id);}}/>}
 <section className="panel"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All tickets</option>{statuses.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
 {q.isPending?<Loading/>:q.error?<Failure message={q.error.message} retry={()=>q.refetch()}/>:!q.data.items.length?<Empty title="No tickets">When you raise a ticket it appears here with its full history.</Empty>:<div className="tablewrap"><table className="datatable"><caption className="sr-only">Your support tickets</caption><thead><tr>{['Ticket','Subject','Type','Status','Updated'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{q.data.items.map(t=><tr key={t.id}><th scope="row"><Link className="textlink" href={'/app/disputes/'+t.id}>#{t.id}</Link></th><td>{t.subject}</td><td>{categories[t.category]}</td><td><Status s={t.status}/></td><td>{date(t.updated_at)}</td></tr>)}</tbody></table></div>}</section></>;
}

function AdminTicket({id}:{id:string}){
 const q=useResource<Detail>('admin/disputes/'+id),cache=useQueryClient();
 const [v,setV]=useState({status:'in_review',body:'',reconsider:false}),[key,setKey]=useState(0);
 const act=useMutation({mutationFn:({action,payload}:{action:string;payload?:object})=>api<Detail>('admin/disputes/'+id+'/'+action,payload||{}),
  onSuccess:()=>{setV({status:'in_review',body:'',reconsider:false});setKey(key+1);cache.invalidateQueries({queryKey:['api']});}});
 if(q.isPending)return <Loading/>;if(q.error)return <Failure message={q.error.message} retry={()=>q.refetch()}/>;
 const t=q.data.ticket,closed=['resolved','rejected','withdrawn'].includes(t.status);
 return <><Link className="textlink" href="/admin/disputes"><ArrowLeft size={15}/> Support tickets</Link>
 <PageHeading kicker={'Ticket '+t.id+' · '+categories[t.category]} title={t.subject} description={t.customer_name+' · '+t.customer_email+' · opened '+date(t.created_at)} action={<Status s={t.status}/>}/>
 {q.data.application&&<p className="muted">Application {q.data.application.tracking_id||q.data.application.id} · {q.data.application.product_name} · {human(q.data.application.status)} · <Link className="textlink" href={'/admin/applications/'+q.data.application.id}>Open in underwriting</Link></p>}
 <section className="panel"><div className="panelhead"><h2>History</h2>{!closed&&<Button variant="outline" size="small" disabled={act.isPending} onClick={()=>act.mutate({action:'assign'})}>{t.assignee_id?'Reassign to me':'Assign to me'}</Button>}</div><Thread id={t.id} messages={q.data.messages} admin/></section>
 {act.error&&<Failure message={errText(act.error)}/>}
 {closed?<p className="muted">This ticket is closed. The customer can reopen it.</p>:<form key={key} className="panel formstack" onSubmit={e=>{e.preventDefault();act.mutate({action:'respond',payload:{status:v.status,body:v.body.trim(),...(v.reconsider?{reconsider:true}:{})}});}}><div className="panelhead"><h2>Respond</h2></div>
 <label>New status<select value={v.status} onChange={e=>setV({...v,status:e.target.value,reconsider:e.target.value==='resolved'&&v.reconsider})}><option value="in_review">In review</option><option value="awaiting_customer">Request more information</option><option value="resolved">Resolve</option><option value="rejected">Reject</option></select></label>
 <label>Response to the customer<textarea required rows={4} maxLength={2000} value={v.body} onChange={e=>setV({...v,body:e.target.value})}/></label>
 {t.category==='application_reconsideration'&&v.status==='resolved'&&<label className="checkrow"><input type="checkbox" checked={v.reconsider} onChange={e=>setV({...v,reconsider:e.target.checked})}/>Send the application back to underwriting as an escalated reconsideration</label>}
 <div><Button disabled={act.isPending||!v.body.trim()}>Send response</Button></div></form>}</>;
}

export function AdminSupportPage({parts}:{parts:string[]}){
 const [status,setStatus]=useState('open'),[category,setCategory]=useState('');
 const q=useResource<{items:Row[];counts:{status:string;count:number}[]}>('admin/disputes?status='+status+'&category='+category);
 if(parts[0])return <AdminTicket id={parts[0]}/>;
 return <><PageHeading kicker="Customer care" title="Support tickets" description="Review evidence, respond to customers and keep a complete resolution history."/>
 <div className="metricgrid">{['open','in_review','awaiting_customer','resolved'].map(s=><div className="metric" key={s}><span>{statusLabel(s)}</span><strong>{q.data?.counts.find(c=>c.status===s)?.count??0}</strong></div>)}</div>
 <section className="panel"><div className="service-filters"><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All</option>{statuses.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label><label>Type<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All</option>{Object.entries(categories).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label></div>
 {q.isPending?<Loading/>:q.error?<Failure message={q.error.message} retry={()=>q.refetch()}/>:!q.data.items.length?<Empty title="No tickets match">Change the filters to see other tickets.</Empty>:<div className="tablewrap"><table className="datatable"><caption className="sr-only">Support tickets</caption><thead><tr>{['Ticket','Customer','Subject','Type','Status','Assigned','Updated'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{q.data.items.map(t=><tr key={t.id}><th scope="row"><Link className="textlink" href={'/admin/disputes/'+t.id}>#{t.id}</Link></th><td>{t.customer_name}</td><td>{t.subject}</td><td>{categories[t.category]}</td><td><Status s={t.status}/></td><td>{t.assignee_name||'Unassigned'}</td><td>{date(t.updated_at)}</td></tr>)}</tbody></table></div>}</section></>;
}
