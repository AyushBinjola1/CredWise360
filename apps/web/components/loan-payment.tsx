'use client';
import {useEffect,useRef,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {LockKeyhole} from 'lucide-react';
import {api,ApiError,date,errText,money} from '@/lib/api';
import {paymentLabels,rupeesToPaise,todayInIndia,type LoanRecord,type PayoffQuote,type PaymentIntent,type PaymentKind,type Receipt} from '@/lib/servicing';
import {Button} from './ui/button';
import {Failure} from './states';

const descriptions:Record<PaymentKind,string>={
 emi:'Pay the oldest unpaid instalment and any applicable late charges.',
 partial:'Put a smaller cash payment toward the oldest unpaid instalment.',
 advance:'Pay toward multiple scheduled instalments in due-date order.',
 prepayment:'Reduce outstanding principal. Product terms determine the prepayment fee and revised schedule.',
 foreclosure:'Settle the remaining principal and applicable interest and charges in one simulated payment.'
};
function needsAmount(kind:PaymentKind){return kind==='partial'||kind==='advance'||kind==='prepayment';}
export function LoanPayment({loan,onReceipt}:{loan:LoanRecord;onReceipt:(r:Receipt)=>void}){
 const cache=useQueryClient();
 const [kind,setKind]=useState<PaymentKind>('emi'),[input,setInput]=useState(''),[asOf,setAsOf]=useState(()=>[todayInIndia(),loan.last_payment_date||loan.opened_on].sort().at(-1)!);
 const [intent,setIntent]=useState<PaymentIntent|null>(null),[quote,setQuote]=useState<PayoffQuote|null>(null),[message,setMessage]=useState(''),[sent,setSent]=useState(false);
 const busy=useRef(false);
 const storageKey='cw-pending-payment-'+loan.user_id+'-'+loan.id;
 useEffect(()=>{try{const raw=sessionStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw) as PaymentIntent;if(saved.key&&saved.body&&saved.body.kind in paymentLabels){setIntent(saved);setSent(true);}}}catch{/* The session can continue without browser storage. */}},[storageKey]);
 const preview=useMutation({mutationFn:async()=>{
  const amount=rupeesToPaise(input);
  if(!asOf)throw Error('Choose a simulated payment date.');
  if(needsAmount(kind)&&amount===null)throw Error('Enter a positive amount with up to two decimal places.');
  const q=await api<PayoffQuote>('loans/'+loan.id+'/payoff',{payment_date:asOf,...(kind==='prepayment'?{amount}: {})});
  if((kind==='prepayment'||kind==='foreclosure')&&!q.allowed)throw Error('This product permits early settlement from '+date(q.earliest_prepayment_date)+'.');
  if(kind==='prepayment'&&!q.prepayment_allowed)throw Error('Settle due instalments and late charges before making a principal prepayment.');
  const exact=kind==='emi'?q.next_amount:kind==='foreclosure'?q.total:amount!;
  if(exact<=0)throw Error('There is no amount payable for this selection.');
  const next:PaymentIntent={key:crypto.randomUUID(),body:{kind,amount:exact,payment_date:q.as_of,expected_version:q.ledger_version},cash:kind==='prepayment'?q.prepayment_total:exact};
  return {next,q};
 },onSuccess:({next,q})=>{setIntent(next);setQuote(q);setMessage('');setSent(false);}});
 const payment=useMutation({mutationFn:async(p:PaymentIntent)=>api<Receipt>('loans/'+loan.id+'/payments',p.body,'POST',undefined,{'Idempotency-Key':p.key}),
  onSuccess:async receipt=>{try{sessionStorage.removeItem(storageKey);}catch{}setIntent(null);setSent(false);setQuote(null);setInput('');onReceipt(receipt);await cache.invalidateQueries({queryKey:['api']});},
  onError:e=>{setMessage(errText(e));if(e instanceof ApiError&&e.status<500&&e.status!==401){try{sessionStorage.removeItem(storageKey);}catch{}setIntent(null);setSent(false);setQuote(null);cache.invalidateQueries({queryKey:['api']});}},
  onSettled:()=>{busy.current=false;}
 });
 function confirm(){if(!intent||busy.current)return;busy.current=true;setMessage('');setSent(true);try{sessionStorage.setItem(storageKey,JSON.stringify(intent));}catch{}payment.mutate(intent);}
 const updating=preview.isPending||payment.isPending;
 return <section id="make-payment" className="panel paypanel"><div className="panelhead"><h2>Make a simulated payment</h2><LockKeyhole size={18}/></div>
 {intent?<div className="payment-review"><span className="eyebrow"><i/>{sent?'Payment confirmation':'Review payment'}</span><h3>{money(intent.cash)}</h3><p>{paymentLabels[intent.body.kind]} · {date(intent.body.payment_date)}</p>
 {quote&&(kind==='foreclosure'||kind==='emi')&&<dl className="service-facts">{(kind==='foreclosure'?[['Outstanding principal',quote.principal],['Interest',quote.interest],['Late charges',quote.penalties],['Settlement fee',quote.fee]]:[['Scheduled principal',quote.next_principal],['Scheduled interest',quote.next_interest],['Late charges',quote.penalties]]).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{money(Number(value))}</dd></div>)}</dl>}
 {quote&&kind==='prepayment'&&<p>Extra principal {money(intent.body.amount)} · Product fee {money(quote.prepayment_fee)}</p>}
 <p>{sent?'Use the same confirmation to retrieve the result of this payment.':'Confirm to record this payment in the simulated loan ledger.'}</p>
 <div className="buttonrow"><Button disabled={updating} onClick={confirm}>{payment.isPending?'Recording…':sent?'Check payment result':'Confirm payment'}</Button>{!sent&&<Button variant="outline" disabled={updating} onClick={()=>{setIntent(null);setQuote(null);}}>Edit payment</Button>}</div></div>:
 <form className="formstack" onSubmit={e=>{e.preventDefault();setMessage('');preview.mutate();}}><fieldset disabled={updating} className="payment-fields"><label>Payment type<select value={kind} onChange={e=>{setKind(e.target.value as PaymentKind);preview.reset();}}>{Object.entries(paymentLabels).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><p>{descriptions[kind]}</p>
 <label>Simulated payment date<input type="date" value={asOf} min={loan.last_payment_date||loan.opened_on} required onChange={e=>setAsOf(e.target.value)}/></label>
 {needsAmount(kind)&&<label>{kind==='prepayment'?'Extra principal (₹)':'Payment amount (₹)'}<input inputMode="decimal" type="number" min=".01" step=".01" required value={input} onChange={e=>setInput(e.target.value)}/></label>}
 <Button disabled={updating}>{preview.isPending?'Calculating…':'Review payment'}</Button></fieldset></form>}
 {(message||preview.error)&&<Failure message={message||errText(preview.error)}/>}</section>;
}
