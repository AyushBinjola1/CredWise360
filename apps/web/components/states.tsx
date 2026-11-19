import {CircleAlert,Inbox} from 'lucide-react';
import {Logo} from './logo';
import {Button} from './ui/button';

/** Placeholder block shown while data loads. Decorative: the surrounding region announces the loading state. */
export function Skeleton({height,width='100%',className=''}:{height?:number|string;width?:number|string;className?:string}){return <span className={('skeleton '+className).trim()} aria-hidden="true" style={{height,width}}/>;}
export function Loading(){return <div className="loading" role="status" aria-live="polite" aria-busy="true"><div className="loading-head"><Logo variant="icon" height={24} decorative className="logo-pulse"/> <span>Loading your workspace…</span></div><div className="loading-lines" aria-hidden="true"><Skeleton height={14} width="62%"/><Skeleton height={14} width="88%"/><Skeleton height={14} width="45%"/></div></div>;}
export function Failure({message,retry}:{message:string;retry?:()=>void}){return <div className="notice danger" role="alert"><CircleAlert size={18} aria-hidden="true"/><div>{message}{retry&&<p><Button variant="outline" size="small" onClick={retry}>Try again</Button></p>}</div></div>;}
export function Empty({title,children}:{title:string;children?:React.ReactNode}){return <div className="empty"><Inbox size={24} aria-hidden="true"/><h3>{title}</h3>{children&&<p>{children}</p>}</div>;}
export function Metric({label,value,detail}:{label:string;value:React.ReactNode;detail?:React.ReactNode}){return <div className="metric"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;}
export function PageHeading({kicker,title,description,action}:{kicker?:string;title:string;description?:string;action?:React.ReactNode}){return <header className="pageheading"><div>{kicker&&<span className="eyebrow"><i/>{kicker}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</header>;}
