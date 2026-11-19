'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Activity,Award,ArrowLeftRight,Banknote,BarChart3,Bell,BookOpen,Building2,CalendarDays,ChartNoAxesCombined,ChevronDown,ChevronRight,ClipboardList,Compass,FileCheck2,FileText,Flag,GraduationCap,HeartPulse,Home,IdCard,Layers,LogOut,Menu,MessagesSquare,PanelLeftClose,PanelLeftOpen,Scale,Search,Settings,Shield,SlidersHorizontal,Target,Users,Wallet,X,type LucideIcon} from 'lucide-react';
import {api,errText,human,useResource} from '@/lib/api';
import type {User} from '@/lib/model';
import {destinations,baseFor} from '@/lib/routes';
import {applyTheme,currentTheme} from '@/lib/theme';
import {Brand} from './brand';
import {Logo} from './logo';
import {ThemeToggle} from './public-header';
import {Failure} from './states';
const icons:Record<string,LucideIcon>={home:Home,wallet:Wallet,identity:IdCard,settings:Settings,users:Users,credit:Activity,twin:Layers,market:Building2,application:ClipboardList,loans:Banknote,debt:Target,stress:HeartPulse,education:GraduationCap,safety:Shield,academy:BookOpen,alerts:Bell,reports:FileText,support:MessagesSquare,fraud:Flag,fairness:Scale,analytics:BarChart3,checks:FileCheck2,comparison:ArrowLeftRight,planner:Compass,calendar:CalendarDays,policy:SlidersHorizontal,rewards:Award,wellbeing:HeartPulse};

/** Remembers a small UI preference for this browser, tolerating blocked storage. */
function useStoredState<T>(key:string,initial:T):[T,(v:T)=>void]{
 const [value,setValue]=useState<T>(initial);
 useEffect(()=>{try{const raw=localStorage.getItem(key);if(raw!==null)setValue(JSON.parse(raw) as T);}catch{/* the default applies */}},[key]);
 const set=useCallback((v:T)=>{setValue(v);try{localStorage.setItem(key,JSON.stringify(v));}catch{/* kept for this visit only */}},[key]);
 return [value,set];
}
function Bellbadge(){const q=useResource<{unread:number}>('dashboard');const n=q.data?.unread??0;return <Link href="/app/notifications" className="iconbutton bell" aria-label={n?n+' unread notifications':'Notifications'}><Bell size={17}/>{n>0&&<span className="bell-count" aria-hidden>{n>9?'9+':n}</span>}</Link>;}

const detailNames:Record<string,string>={applications:'Application',loans:'Loan',disputes:'Ticket'};
function detailLabel(slug:string,parts:string[]){
 const id=parts[1];if(!id)return '';
 if(detailNames[slug])return parts[2]==='certificate'?detailNames[slug]+' '+id+' · Certificate':detailNames[slug]+' '+id;
 return human(id);
}

function AccountMenu({user,base,onLogout}:{user:User;base:string;onLogout:()=>void}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const away=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('mousedown',away);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('mousedown',away);document.removeEventListener('keydown',key);};
 },[open]);
 const dark=typeof document!=='undefined'&&currentTheme()==='dark';
 return <div className="acct" ref={root}><button ref={trigger} className="avatar acct-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={()=>setOpen(!open)}>{user.name.slice(0,1).toUpperCase()}</button>
 {open&&<div className="acct-menu" role="menu" aria-label="Account"><div className="acct-head"><strong>{user.name}</strong><small>{user.email}</small><span className="pill">{user.role==='admin'?'Administrator':'Borrower'}</span></div>
 <Link role="menuitem" href={base+'/settings'} onClick={()=>setOpen(false)}><Settings size={16}/>Account settings</Link>
 <button role="menuitem" onClick={()=>{applyTheme(dark?'light':'dark');setOpen(false);}}>{dark?'Switch to light theme':'Switch to dark theme'}</button>
 <button role="menuitem" onClick={onLogout}><LogOut size={16}/>Sign out</button></div>}</div>;
}

export function WorkspaceShell({user,slug,parts=[],children}:{user:User;slug:string;parts?:string[];children:React.ReactNode}){
 const router=useRouter(),cache=useQueryClient(),nav=destinations(user.role),base=baseFor(user.role),current=nav.find(x=>x.slug===slug);
 const mobile=useRef<HTMLDialogElement>(null),searchDialog=useRef<HTMLDialogElement>(null);
 const [query,setQuery]=useState(''),[error,setError]=useState('');
 const [collapsed,setCollapsed]=useStoredState<boolean>('cw-nav-collapsed',false);
 const [closed,setClosed]=useStoredState<string[]>('cw-nav-closed-groups',[]);
 const groups=[...new Set(nav.map(x=>x.group))],activeGroup=current?.group;
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();searchDialog.current?.showModal();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const toggleGroup=(g:string)=>setClosed(closed.includes(g)?closed.filter(x=>x!==g):[...closed,g]);
 const links=(compact:boolean,expandable:boolean)=><nav aria-label="Workspace navigation">{groups.map(group=>{
  const shut=expandable&&!compact&&closed.includes(group)&&group!==activeGroup,id='navgroup-'+group.replace(/\W+/g,'-');
  return <div className="navgroup" key={group}>
   {compact?<span className="navrule" aria-hidden/>:expandable?<h2><button className="navgroup-toggle" aria-expanded={!shut} aria-controls={id} onClick={()=>toggleGroup(group)}>{group}<ChevronDown size={13} aria-hidden/></button></h2>:<h2>{group}</h2>}
   <div id={id} hidden={shut}>{nav.filter(x=>x.group===group).map(x=>{const Icon=icons[x.icon]||ChartNoAxesCombined;return <Link href={base+(x.slug?'/'+x.slug:'')} key={x.slug} title={compact?x.name:undefined} aria-label={compact?x.name:undefined} aria-current={x.slug===slug?'page':undefined} onClick={()=>mobile.current?.close()}><Icon size={17} aria-hidden/><span className="navlabel">{x.name}</span></Link>;})}</div>
  </div>;})}</nav>;
 async function logout(){try{await api('auth/logout',{});cache.clear();router.replace('/login');router.refresh();}catch(e){setError(errText(e));}}
 const detail=detailLabel(slug,parts);
 const matches=nav.filter(x=>(x.name+' '+x.group).toLowerCase().includes(query.toLowerCase()));
 return <div className="workspace" data-collapsed={collapsed?'true':'false'}><aside className="side"><div className="side-top">{collapsed?<Link href={base} aria-label="CredWise 360 workspace home" className="brand"><Logo variant="icon" height={34} decorative/></Link>:<Brand height={34}/>}<button className="iconbutton collapse-toggle" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} aria-pressed={collapsed} onClick={()=>setCollapsed(!collapsed)}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button></div>{links(collapsed,true)}<div className="sidefoot"><span className="avatar" aria-hidden>{user.name.slice(0,1).toUpperCase()}</span><div className="sidefoot-text"><strong>{user.name}</strong><small>{user.role==='admin'?'Administrator':'Borrower account'}</small></div><button className="iconplain" aria-label="Sign out" title="Sign out" onClick={logout}><LogOut size={17}/></button></div></aside>
 <div className="workbody"><header className="topbar"><button className="iconbutton hamburger" aria-label="Open navigation" onClick={()=>mobile.current?.showModal()}><Menu size={18}/></button><Link href={base} className="topbar-brand" aria-label="CredWise 360 workspace home"><Logo variant="icon" height={30} decorative/></Link>
 <nav className="crumb" aria-label="Breadcrumb"><ol><li>{user.role==='admin'?'Operations':'Workspace'}</li>{current&&<li>{detail?<Link href={base+(slug?'/'+slug:'')}>{current.name}</Link>:<b aria-current="page">{current.name}</b>}</li>}{detail&&<li><b aria-current="page">{detail}</b></li>}</ol></nav>
 <div className="toptools">{user.role==='customer'&&<Bellbadge/>}<button className="iconbutton" aria-label="Search workspace (Ctrl+K)" onClick={()=>searchDialog.current?.showModal()}><Search size={17}/></button><ThemeToggle/><AccountMenu user={user} base={base} onLogout={logout}/></div></header><main id="main" className="workspace-main">{error&&<Failure message={error}/>} {children}</main><div className="workfooter"><Shield size={13}/> Educational simulation · All amounts in INR</div></div>
 <dialog ref={mobile} className="navdialog" aria-label="Navigation"><div className="dialogtop"><Brand height={32}/><button aria-label="Close navigation" className="iconbutton" onClick={()=>mobile.current?.close()}><X size={18}/></button></div>{links(false,false)}<button className="button outline" onClick={logout}><LogOut size={16}/> Sign out</button></dialog>
 <dialog className="searchdialog" ref={searchDialog} aria-label="Search workspace" onClose={()=>setQuery('')}><div className="dialogtop"><h2>Search workspace</h2><button className="iconbutton" aria-label="Close search" onClick={()=>searchDialog.current?.close()}><X size={18}/></button></div><label>Find a page<input autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search pages and tools"/></label><div className="searchresults" role="region" aria-live="polite">{matches.map(x=><Link key={x.slug} href={base+(x.slug?'/'+x.slug:'')} onClick={()=>{searchDialog.current?.close();setQuery('');}}>{x.name}<ChevronRight size={15}/></Link>)}{!matches.length&&<p>No matching page.</p>}</div></dialog></div>;
}
