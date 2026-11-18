'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,ClipboardCheck,Coins,Leaf,Wallet} from 'lucide-react';
import {useResource,money} from '@/lib/api';
import type {Assessment} from './credit';
import type {User,ProfileResult} from '@/lib/model';
import {Loading,Failure,Metric,PageHeading} from './states';
const CashChart=dynamic(()=>import('./cash-chart'),{ssr:false});
export function Overview({user}:{user:User}){
 const result=useResource<ProfileResult>('profile'),credit=useResource<Assessment>('credit');
 if(result.isPending)return <Loading/>;if(result.error)return <Failure message={result.error.message} retry={()=>result.refetch()}/>;
 const {profile:p,metrics:m}=result.data;
 return <><PageHeading kicker="Borrower workspace" title={'Hello, '+user.name.split(' ')[0]+'.'} description="Here’s where your finances stand today."/>
 <section className="balance"><div><span className="eyebrow"><i/> Monthly disposable income</span><strong>{money(m.disposable)}</strong><p>Income available after monthly spending and EMI commitments.</p><Link href="/app/profile">View financial profile <ArrowUpRight size={16}/></Link></div><div className="balance-glyph" aria-hidden><Leaf size={98} strokeWidth={.75}/></div></section>
 <div className="metricgrid"><Metric label="Monthly income" value={money(m.income)}/><Metric label="EMI-to-income" value={m.emi_ratio==null?'Add income':m.emi_ratio.toFixed(1)+'%'}/><Metric label="Emergency coverage" value={m.coverage==null?'Add expenses':m.coverage.toFixed(1)+' months'}/></div>
 {credit.data&&<div className="panel"><Link className="actionrow" href="/app/credit"><Leaf size={22}/><span><strong>Simulated credit score · {credit.data.score??'More evidence needed'}</strong><small>See your assessment factors and improvement suggestions.</small></span><ArrowRight size={16}/></Link></div>}
 <div className="splitgrid"><section className="panel"><div className="panelhead"><h2>Monthly cash flow</h2><Wallet size={19}/></div><CashChart rows={[{name:'Income',amount:m.income},{name:'Essentials',amount:p.essential},{name:'Optional',amount:p.discretionary},{name:'EMIs',amount:p.existing_emi},{name:'Savings',amount:p.savings}]}/></section>
 <section className="panel"><div className="panelhead"><h2>Your next steps</h2><Coins size={19}/></div><Link className="actionrow" href="/app/profile"><Wallet size={21}/><span><strong>Review your budget</strong><small>Keep your income and spending up to date.</small></span><ArrowRight size={16}/></Link><Link className="actionrow" href="/app/kyc"><ClipboardCheck size={21}/><span><strong>Check your KYC status</strong><small>Review your simulated identity record.</small></span><ArrowRight size={16}/></Link></section></div></>;
}
export function AdminOverview(){const users=useResource<unknown>('admin/users'),kyc=useResource<unknown>('admin/kyc');
 const count=(value:unknown)=>Array.isArray(value)?value.length:typeof value==='object'&&value!==null&&'items' in value&&Array.isArray(value.items)?value.items.length:0;
 return <><PageHeading kicker="Administrator workspace" title="Executive overview" description="Review the customers and identity cases in your lending portfolio."/>
 {(users.isPending||kyc.isPending)?<Loading/>:(users.error||kyc.error)?<Failure message={users.error?.message||kyc.error!.message}/>:<div className="metricgrid"><Metric label="Customer records on this page" value={count(users.data)}/><Metric label="KYC records on this page" value={count(kyc.data)}/></div>}
 <div className="panel"><Link className="actionrow" href="/admin/users"><Wallet/><span><strong>Customer directory</strong><small>Find a customer and review account access.</small></span><ArrowRight size={16}/></Link><Link className="actionrow" href="/admin/kyc"><ClipboardCheck/><span><strong>Identity review queue</strong><small>Review submitted synthetic documents.</small></span><ArrowRight size={16}/></Link></div></>;}
