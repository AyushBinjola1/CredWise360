import {cookies} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {baseFor,destinations} from '@/lib/routes';
import type {User,Role} from '@/lib/model';
import {WorkspaceShell} from './workspace-shell';
import {WorkspaceContent} from './workspace-content';
export async function GuardedPage({role,parts}:{role:Role;parts:string[]}){
 const token=(await cookies()).get('cw')?.value;
 if(!token)redirect('/login');
 const response=await fetch((process.env.CORE_URL||'http://127.0.0.1:8787')+'/api/auth/me',{headers:{cookie:'cw='+token},cache:'no-store'});
 if(response.status===401||response.status===403)redirect('/login');
 if(!response.ok)throw Error('The lending service could not load your account.');
 const {data:{user}}=await response.json() as {data:{user:User}};
 if(user.role!==role)redirect(baseFor(user.role));
 const slug=parts[0]||'';
 if(!destinations(role).some(x=>x.slug===slug))notFound();
 return <WorkspaceShell user={user} slug={slug}><WorkspaceContent user={user} slug={slug} parts={parts.slice(1)}/></WorkspaceShell>;
}
