import {notFound} from 'next/navigation';import {PublicTool} from '@/components/public-tool';import {MarketplacePage} from '@/components/marketplace';
export const metadata={title:'Loan marketplace'};
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){const s=(await params).slug||[];if(s.length>1)notFound();return <PublicTool><MarketplacePage signedIn={false} slug={s[0]}/></PublicTool>;}
