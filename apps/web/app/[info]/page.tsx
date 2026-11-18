import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {information} from '@/lib/public-info';
import {Button} from '@/components/ui/button';
import {PublicHeader} from '@/components/public-header';
import {PublicFooter} from '@/components/public-footer';
export function generateStaticParams(){return Object.keys(information).map(info=>({info}));}
export const dynamicParams=false;
export async function generateMetadata({params}:{params:Promise<{info:keyof typeof information}>}){const {info}=await params;return {title:information[info]?.title||'Page'};}
export default async function Page({params}:{params:Promise<{info:keyof typeof information}>}){
 const {info}=await params,entry=information[info];if(!entry)notFound();
 return <><PublicHeader/><main id="main" className="wrap info-reading"><Link href="/" className="textlink"><ArrowLeft size={14}/> CredWise home</Link><h1>{entry.title}</h1><p className="intro">{entry.intro}</p><div className="info-sections">{entry.sections.map(([heading,text])=>info==='faq'?<details key={heading}><summary>{heading}</summary><p>{text}</p></details>:<section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}</div><Button asChild><Link href="/login">Open the demo <ArrowRight size={16}/></Link></Button></main><PublicFooter/></>;
}
