'use client';
import {useEffect} from 'react';

/**
 * Makes every data table readable on narrow screens. Tables with up to six columns become labelled cards
 * (CSS in design-system.css). Wider ones, such as repayment schedules, keep their columns and scroll sideways
 * with a pinned first column. It only adds classes and data-label attributes, so the table markup stays semantic.
 */
export function TableLabels(){
 useEffect(()=>{
  let queued=false;
  const apply=()=>{
   queued=false;
   document.querySelectorAll<HTMLElement>('.tablewrap').forEach(wrap=>{
    if(!wrap.hasAttribute('tabindex')){
     const table=wrap.querySelector('table'),caption=table?.querySelector('caption')?.textContent?.trim();
     wrap.setAttribute('tabindex','0');wrap.setAttribute('role','region');wrap.setAttribute('aria-label',caption||'Data table, scrollable');
    }
   });
   document.querySelectorAll<HTMLTableElement>('table.datatable').forEach(table=>{
    const heads=[...table.querySelectorAll('thead th')].map(h=>{const b=h.querySelector('button');return ((b?b.childNodes[0]?.textContent:h.textContent)||'').trim();});
    if(heads.length>=7){table.classList.add('keep-scroll');return;}
    table.classList.add('as-cards');
    table.querySelectorAll('tbody tr').forEach(row=>{[...row.children].forEach((cell,i)=>{if(heads[i]&&cell.getAttribute('data-label')!==heads[i])cell.setAttribute('data-label',heads[i]);});});
   });
  };
  const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(apply);}};
  apply();
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[]);
 return null;
}
