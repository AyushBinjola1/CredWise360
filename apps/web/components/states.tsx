import {CircleAlert,Inbox,LoaderCircle} from 'lucide-react';
import {Button} from './ui/button';
export function Loading(){return <div className="loading" role="status"><LoaderCircle size={19} className="turn"/> Loading your workspace…</div>;}
export function Failure({message,retry}:{message:string;retry?:()=>void}){return <div className="notice danger" role="alert"><CircleAlert size={18}/><div>{message}{retry&&<p><Button variant="outline" size="small" onClick={retry}>Try again</Button></p>}</div></div>;}
export function Empty({title,children}:{title:string;children?:React.ReactNode}){return <div className="empty"><Inbox size={24}/><h3>{title}</h3>{children&&<p>{children}</p>}</div>;}
export function Metric({label,value,detail}:{label:string;value:React.ReactNode;detail?:React.ReactNode}){return <div className="metric"><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;}
export function PageHeading({kicker,title,description,action}:{kicker?:string;title:string;description?:string;action?:React.ReactNode}){return <header className="pageheading"><div>{kicker&&<span className="eyebrow"><i/>{kicker}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</header>;}
