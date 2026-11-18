'use client';
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {money} from '@/lib/api';
export default function CashChart({rows}:{rows:{name:string;amount:number}[]}){
 return <div className="chartbox" role="img" aria-label={rows.map(r=>r.name+' '+money(r.amount)).join(', ')}><ResponsiveContainer width="100%" height="100%" minWidth={1}><BarChart data={rows} margin={{left:0,top:8,right:6,bottom:0}}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5"/><XAxis dataKey="name" fontSize={11} stroke="var(--muted)" tickLine={false} axisLine={false}/><YAxis width={56} fontSize={10} stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={v=>'₹'+(Number(v)/100000).toFixed(0)+'k'}/><Tooltip formatter={v=>money(Number(v))} contentStyle={{background:'var(--surface)',borderColor:'var(--line)',borderRadius:8}}/><Bar dataKey="amount" name="Amount" fill="#539374" radius={[6,6,0,0]} maxBarSize={56} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>;
}
