'use client';
import {useEffect,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {api,useResource,errText} from '@/lib/api';
import {Loading,Failure,PageHeading} from './states';
import {Button} from './ui/button';
const numericFields=[
 ['min_amount','Minimum principal (₹)',100],['max_amount','Maximum principal (₹)',100],['min_months','Minimum months',1],['max_months','Maximum months',1],['rate_bps','Annual interest (%)',100],['fee_bps','Processing fee (%)',100],['fee_cap','Processing fee cap (₹)',100],['min_income','Minimum monthly income (₹)',100],
 ['max_emi_percent','Maximum EMI-to-income (%)',1],['min_score','Minimum simulated score',1],['min_stability_months','Minimum employment duration (months)',1],['prepayment_from_month','First permitted prepayment month',1],['prepayment_fee_bps','Prepayment fee (%)',100],['late_fee','Late fee (₹)',100],['grace_days','Grace period (days)',1]
] as const;
type Product=Record<typeof numericFields[number][0],number>&{slug:string;name:string;description:string;collateral:string;risk_policy:string;method:string;purposes:string[];documents:string[];updated_at:string};
export function ProductAdmin(){
 const list=useResource<{items:Product[]}>('products'),cache=useQueryClient(),[key,setKey]=useState(''),[record,setRecord]=useState<Product|null>(null),[message,setMessage]=useState('');
 const selected=key||list.data?.items[0]?.slug||'';
 const product=useResource<Product>('admin/products/'+selected,!!selected);
 useEffect(()=>{if(product.data)setRecord(product.data);},[product.data]);
 const save=useMutation({mutationFn:async()=>{
  if(!record||!product.data)throw Error('Load a product first.');
  const editable=[...numericFields.map(f=>f[0]),'name','description','collateral','risk_policy','method','purposes','documents'] as (keyof Product)[];
  const changes=Object.fromEntries(editable.filter(k=>JSON.stringify(record[k])!==JSON.stringify(product.data![k])).map(k=>[k,record[k]]));
  return api('admin/products/'+selected,{...changes,base_updated_at:product.data.updated_at},'PUT');
 },onSuccess:()=>{setMessage('Product configuration saved.');cache.invalidateQueries({queryKey:['api']});}});
 return <><PageHeading kicker="Loan policies" title="Product configuration" description="Manage the eligibility, pricing and repayment rules for each synthetic product."/>
 {list.error&&<Failure message={list.error.message}/>}<section className="panel"><label>Product<select value={selected} onChange={e=>{setKey(e.target.value);setMessage('');}}>{list.data?.items.map(p=><option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label></section>
 {product.isPending?<Loading/>:product.error?<Failure message={product.error.message}/>:record&&<form className="panel formstack" onSubmit={e=>{e.preventDefault();setMessage('');save.mutate();}}>
 <div className="panelhead"><h2>{record.name}</h2></div><div className="controlgrid">{numericFields.map(([field,label,scale])=><label key={field}>{label}<input type="number" min="0" required step={scale===100?'0.01':'1'} value={record[field]/scale} onChange={e=>setRecord({...record,[field]:Math.round(Number(e.target.value)*scale)})}/></label>)}</div>
 <label>Interest convention<select value={record.method} onChange={e=>setRecord({...record,method:e.target.value})}><option value="reducing">Reducing balance</option><option value="flat">Flat interest</option></select></label>
 <details><summary>Product description and evidence requirements</summary><div className="formstack">
 {([['name','Product name'],['description','Description'],['collateral','Collateral requirements'],['risk_policy','Risk review policy']] as const).map(([f,label])=><label key={f}>{label}<textarea value={record[f]} required onChange={e=>setRecord({...record,[f]:e.target.value})}/></label>)}
 {([['purposes','Supported purposes'],['documents','Required synthetic documents']] as const).map(([f,label])=><label key={f}>{label} (one per line)<textarea value={record[f].join('\n')} onChange={e=>setRecord({...record,[f]:e.target.value.split('\n')})}/></label>)}</div></details>
 <div><Button disabled={save.isPending||JSON.stringify(record)===JSON.stringify(product.data)}>Save configuration</Button></div>{save.error&&<Failure message={errText(save.error)}/>}<p role="status">{message}</p></form>}</>;
}
