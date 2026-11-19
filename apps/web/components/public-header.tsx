'use client';
import {useEffect,useRef,useState} from 'react';
import {Menu,Moon,Sun,X} from 'lucide-react';
import {Brand} from './brand';
import Link from 'next/link';
import {Button} from './ui/button';
export function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{setDark(localStorage.getItem('cw-theme')==='dark');},[]);
 return <button className="iconbutton" aria-label={dark?'Use light theme':'Use dark theme'} onClick={()=>{const next=dark?'light':'dark';setDark(!dark);localStorage.setItem('cw-theme',next);document.documentElement.dataset.theme=next;}}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>;
}
export function PublicHeader(){
 const menu=useRef<HTMLDialogElement>(null);
 const destinations=[['Loan products','products'],['Calculator','calculator'],['Compare','compare'],['Learn','resources']];
 const links=destinations.map(([name,path])=><Link href={'/'+path} key={path} onClick={()=>menu.current?.close()}>{name}</Link>);
 return <header className="public-header"><div className="wrap bar"><Brand height={34} responsive/><nav aria-label="Main navigation">{links}</nav><div className="headeractions"><ThemeToggle/><Button size="small" asChild><Link href="/login">Sign in</Link></Button><button aria-label="Open site navigation" className="iconbutton publicmenu" onClick={()=>menu.current?.showModal()}><Menu size={18}/></button></div></div><dialog ref={menu} className="mobile-public"><div className="dialogtop"><Brand height={32}/><button className="iconbutton" aria-label="Close site navigation" onClick={()=>menu.current?.close()}><X size={18}/></button></div><nav aria-label="Mobile site navigation">{links}</nav></dialog></header>;
}
