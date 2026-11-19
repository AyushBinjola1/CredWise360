'use client';
import {useQuery} from '@tanstack/react-query';
export class ApiError extends Error{
 constructor(public status:number,public code:string,message:string){super(message);}
}
export async function api<T>(path:string,body?:unknown,method?:string,signal?:AbortSignal,headers?:Record<string,string>):Promise<T>{
 const response=await fetch('/api/'+path,{method:method||(body===undefined?'GET':'POST'),credentials:'same-origin',cache:'no-store',signal,headers:{...(body===undefined?{}:{'Content-Type':'application/json','X-CredWise-Action':'1'}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await response.json().catch(()=>({error:{code:'unavailable',message:'The service could not return this page. Please retry.'}}));
 if(!response.ok||result.error)throw new ApiError(response.status,result.error?.code||'error',result.error?.message||'The request failed.');
 return result.data as T;
}
export function useResource<T>(path:string,enabled=true){return useQuery<T,ApiError>({queryKey:['api',path],queryFn:({signal})=>api<T>(path,undefined,'GET',signal),enabled});}
const rupees=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2,minimumFractionDigits:2});
const wholeRupees=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0});
export function money(paise:number){return (paise%100===0?wholeRupees:rupees).format(paise/100);}
export function human(value:string){return value.replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase());}
export function date(value:string){return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(value));}
export function errText(e:unknown){return e instanceof Error?e.message:'The request could not be completed.';}
