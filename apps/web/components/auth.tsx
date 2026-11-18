'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {ArrowRight,KeyRound,UserRound,ShieldCheck,Eye,EyeOff} from 'lucide-react';
import {api,errText} from '@/lib/api';
import type {User} from '@/lib/model';
import {baseFor} from '@/lib/routes';
import {Brand} from './brand';
import {ThemeToggle} from './public-header';
import {Failure} from './states';
import {Button} from './ui/button';
const password=z.string().min(1,'Enter your password.');
const schema=z.object({email:z.email('Enter a valid email address.'),password,name:z.string().optional(),recovery_code:z.string().optional()});
type Fields=z.infer<typeof schema>;
export function Auth({mode}:{mode:'login'|'register'|'recover'}){
 const router=useRouter(),[error,setError]=useState(''),[code,setCode]=useState(''),[visible,setVisible]=useState(false),[done,setDone]=useState(false);
 const registerMode=mode==='register',recovery=mode==='recover';
 const {register,handleSubmit,setValue,setError:fieldError,formState:{errors,isSubmitting}}=useForm<Fields>({resolver:zodResolver(schema)});
 const title=registerMode?'Create your account':recovery?'Recover your account':'Welcome back';
 const submit=handleSubmit(async values=>{
  setError('');
  if(registerMode&&!values.name?.trim()){fieldError('name',{message:'Enter a name for your demo account.'});return;}
  if((registerMode||recovery)&&values.password.length<12){fieldError('password',{message:'Use at least 12 characters.'});return;}
  if(recovery&&!values.recovery_code?.trim()){fieldError('recovery_code',{message:'Enter your saved recovery code.'});return;}
  try{
   const result=await api<{user?:User;recovery_code?:string}>('auth/'+mode,recovery?{email:values.email,recovery_code:values.recovery_code,new_password:values.password}:values);
   if(result.recovery_code)setCode(result.recovery_code);
   if(registerMode||recovery){setDone(true);return;}
   router.replace(baseFor(result.user!.role));router.refresh();
  }catch(e){setError(errText(e));}
 });
 function fill(role:'admin'|'borrower'){setValue('email',role+'@credwise.test',{shouldValidate:true});setValue('password','CredWiseDemo!360',{shouldValidate:true});}
 return <main id="main" className="authscreen"><div className="authbar"><Brand/><ThemeToggle/></div><div className="authgrid"><aside className="authart"><img src="/images/planning-at-home.webp" alt="" width="1536" height="1024"/><div><span className="eyebrow">CredWise 360</span><h2>A clearer view<br/>of your finances.</h2><p>Borrow wisely. Build credit. Achieve financial freedom.</p></div></aside>
 <section className="authform">{done?<><div className="formicon"><KeyRound/></div><h1>{registerMode?'Your workspace is ready':'Password updated'}</h1>{code&&<><p>Save this one-time recovery code somewhere private. You can use it if you forget your password.</p><output className="recovery-code">{code}</output></>}<Button asChild><Link href={registerMode?'/app':'/login'}>{registerMode?'Open my workspace':'Return to sign in'}<ArrowRight size={17}/></Link></Button></>:<>
 <span className="eyebrow"><i/> Secure workspace</span><h1>{title}</h1><p>{registerMode?'Use a fictional name and email for this local learning account.':recovery?'Use the recovery code you saved when creating your account.':'Sign in to your responsible lending workspace.'}</p>
 {error&&<Failure message={error}/>}<form onSubmit={submit} noValidate>{registerMode&&<label>Full name<input autoComplete="nickname" {...register('name')}/><small>{errors.name?.message}</small></label>}
 <label>Email address<input type="email" autoComplete="username" placeholder="you@example.test" {...register('email')}/><small>{errors.email?.message}</small></label>
 {recovery&&<label>Recovery code<input autoComplete="off" {...register('recovery_code')}/><small>{errors.recovery_code?.message}</small></label>}
 <label>{recovery?'New password':'Password'}<span className="passwordwrap"><input type={visible?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} {...register('password')}/><button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></span><small>{errors.password?.message}</small></label>
 {!registerMode&&!recovery&&<Link className="under" href="/recover">Forgot your password?</Link>}
 <Button disabled={isSubmitting}>{isSubmitting?'Please wait…':registerMode?'Create account':recovery?'Reset password':'Sign in'}<ArrowRight size={16}/></Button></form>
 {mode==='login'&&<div className="demo-options"><strong>Use a demo account</strong><div><Button size="small" variant="outline" onClick={()=>fill('borrower')}><UserRound size={15}/>Borrower</Button><Button size="small" variant="outline" onClick={()=>fill('admin')}><ShieldCheck size={15}/>Administrator</Button></div></div>}
 <p className="authfoot">{mode==='login'?'New to CredWise? ':''}<Link className="under" href={mode==='login'?'/register':'/login'}>{mode==='login'?'Create an account':'Back to sign in'}</Link></p></>}</section></div></main>;
}
