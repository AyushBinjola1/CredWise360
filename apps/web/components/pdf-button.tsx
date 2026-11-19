'use client';
import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {FileDown} from 'lucide-react';
import {api,errText} from '@/lib/api';
import {saveSynthetic,type SyntheticDocument} from '@/lib/synthetic-document';
import {Button} from './ui/button';
// Downloads a PDF that the C++ service renders from current records.
export function PdfButton({path,label='Download PDF',size='small'}:{path:string;label?:string;size?:'small'|'default'}){
 const [error,setError]=useState('');
 const get=useMutation({mutationFn:()=>api<SyntheticDocument>(path),onSuccess:saveSynthetic,onMutate:()=>setError(''),onError:e=>setError(errText(e))});
 return <span className="pdf-button no-print"><Button type="button" variant="outline" size={size} disabled={get.isPending} onClick={()=>get.mutate()}><FileDown size={15}/>{get.isPending?'Preparing…':label}</Button>{error&&<small role="alert" className="pdf-error">{error}</small>}</span>;
}
