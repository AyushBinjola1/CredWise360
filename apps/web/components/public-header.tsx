'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {Brand} from './brand';
export function ThemeToggle() {
 const [dark,setDark]=useState(false);
 useEffect(()=>{setDark(localStorage.getItem('cw-theme')==='dark');},[]);
 return <button className="iconbutton" aria-label={dark?'Use light theme':'Use dark theme'} onClick={()=>{const next=dark?'light':'dark';setDark(!dark);localStorage.setItem('cw-theme',next);document.documentElement.dataset.theme=next;}}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button>;
}
export function PublicHeader() {return <header className="public-header"><div className="wrap bar"><Brand/><nav aria-label="Main navigation"><a href="/#approach">Our approach</a><a href="/#guide">How it works</a></nav><ThemeToggle/></div></header>;}
