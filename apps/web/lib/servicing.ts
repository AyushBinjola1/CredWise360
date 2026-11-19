import {date,money} from './api';

export type PaymentKind = 'emi'|'partial'|'advance'|'prepayment'|'foreclosure';
export interface LoanRecord {
  id:number; application_id:number; user_id:number; borrower_name:string; product_slug:string; product_name:string;
  principal:number; outstanding:number; emi:number; rate_bps:number; months:number; remaining_months:number;
  principal_paid:number; interest_paid:number; fees_paid:number; total_paid:number; next_due_date:string|null;
  next_amount:number; progress:number; status:string; opened_on:string; closed_on:string|null; last_payment_date:string|null;
}
export interface ScheduleRow {month:number;due_date:string;payment:number;principal:number;interest:number;balance:number;principal_paid:number;interest_paid:number;remaining:number;status:string;paid_on:string|null}
export interface PostedTransaction {id:number;reference:string;kind:PaymentKind|'disbursement';amount:number;principal:number;interest:number;penalty:number;fee:number;payment_date:string}
export interface LoanPenalty {month:number;amount:number;paid?:number;assessed_on?:string;due_date?:string}
export interface Certificate {reference:string;loan_id:number;application_id:number;borrower_name:string;product_name:string;original_principal:number;principal_paid:number;interest_paid:number;fees_paid:number;total_paid:number;closed_on:string;title:string;disclaimer:string}
export interface LoanDetail {loan:LoanRecord;schedule:ScheduleRow[];transactions:PostedTransaction[];penalties:LoanPenalty[];certificate:Certificate|null}
export interface PayoffQuote {as_of:string;principal:number;interest:number;penalties:number;fee:number;total:number;allowed:boolean;earliest_prepayment_date:string;next_amount:number;next_principal:number;next_interest:number;prepayment_fee:number;prepayment_total:number;prepayment_allowed:boolean;scheduled_due:number;payment_earliest_date:string;ledger_version:number}
export interface PaymentBody {kind:PaymentKind;amount:number;payment_date:string;expected_version:number}
export interface PaymentIntent {key:string;body:PaymentBody;cash:number}
export interface Receipt {transaction:PostedTransaction;loan:LoanRecord}

export const paymentLabels:Record<PaymentKind,string>={emi:'Scheduled EMI',partial:'Partial payment',advance:'Advance instalments',prepayment:'Principal prepayment',foreclosure:'Full settlement'};
export function rupeesToPaise(input:string):number|null{
  const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if(!match)return null;
  const value=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));
  return Number.isSafeInteger(value)&&value>0?value:null;
}
export function todayInIndia(){return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Kolkata'}).format(new Date());}
export function certificateRows(c:Certificate):[string,string][]{
  return [['Borrower',c.borrower_name],['Loan',c.product_name],['Loan account',String(c.loan_id)],['Application',String(c.application_id)],['Original principal',money(c.original_principal)],['Principal repaid',money(c.principal_paid)],['Interest paid',money(c.interest_paid)],['Fees and penalties paid',money(c.fees_paid)],['Total payments',money(c.total_paid)],['Closure date',date(c.closed_on)]];
}
export function downloadCertificate(c:Certificate){
  const doc=document.implementation.createHTMLDocument('CredWise 360 · '+c.reference);
  doc.documentElement.lang='en';
  const style=doc.createElement('style');
  style.textContent='body{font:16px/1.6 system-ui,sans-serif;color:#193e2e;margin:8% auto;padding:32px;max-width:690px;border-top:6px solid #256347}h1{font-size:34px;margin-bottom:6px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #d8dfd9;padding:8px}footer{margin-top:25px;font-size:13px}@media print{body{margin:0}}';
  doc.head.append(style);
  const add=(tag:string,text:string)=>{const el=doc.createElement(tag);el.textContent=text;doc.body.append(el);};
  add('header','CredWise 360 · Educational lending simulation');add('h1',c.title);add('p',c.reference);
  const table=doc.createElement('table');
  for(const [label,value] of certificateRows(c)){const tr=table.insertRow(),th=doc.createElement('th');th.scope='row';th.textContent=label;tr.append(th);tr.insertCell().textContent=value;}
  doc.body.append(table);add('footer',c.disclaimer);
  const url=URL.createObjectURL(new Blob(['<!doctype html>\n',doc.documentElement.outerHTML],{type:'text/html;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=c.reference.replace(/[^A-Za-z0-9_-]/g,'-')+'.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
