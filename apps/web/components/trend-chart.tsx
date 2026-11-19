'use client';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {money} from '@/lib/api';
export default function TrendChart({rows,label,unit='Month'}:{rows:{x:number;y:number}[];label:string;unit?:string}){
 return <div className="chartbox" role="img" aria-label={label}><ResponsiveContainer width="100%" height="100%" minWidth={1}><LineChart data={rows} margin={{left:0,top:8,right:8,bottom:0}}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5"/><XAxis dataKey="x" fontSize={11} stroke="var(--muted)" tickLine={false} axisLine={false}/><YAxis width={56} fontSize={10} stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={v=>'₹'+(Number(v)/100000).toFixed(0)+'k'}/><Tooltip labelFormatter={v=>unit+' '+v} formatter={v=>money(Number(v))} contentStyle={{background:'var(--surface)',borderColor:'var(--line)',borderRadius:8}}/><Line type="monotone" dataKey="y" name={label} stroke="#539374" strokeWidth={2.5} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>;
}
