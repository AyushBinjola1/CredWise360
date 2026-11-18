'use client';
import {Download,Printer} from 'lucide-react';
import {Button} from './ui/button';
type Cell=string|number|boolean|null;
function csvCell(value:Cell):string{
 let text=value===null?'':String(value);
 if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function downloadCsv(filename:string,columns:string[],rows:Cell[][]){
 const content='\uFEFF'+[columns,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename.replace(/[^a-z0-9_-]/gi,'-')+'.csv';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function ExportTools({name,columns,rows}:{name:string;columns:string[];rows:Cell[][]}){return <div className="buttonrow no-print"><Button type="button" variant="outline" size="small" onClick={()=>downloadCsv(name,columns,rows)}><Download size={15}/>Export CSV</Button><Button type="button" variant="outline" size="small" onClick={()=>window.print()}><Printer size={15}/>Print report</Button></div>;}
