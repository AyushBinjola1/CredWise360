'use client';
import {useEffect,useState} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {applyTheme,storedTheme} from '@/lib/theme';
import {TableLabels} from './table-labels';
export function Providers({children}:{children:React.ReactNode}) {
  const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,staleTime:15000,refetchOnWindowFocus:false}}}));
  // Follow the operating system's theme until the visitor makes an explicit choice.
  useEffect(()=>{
   const query=matchMedia('(prefers-color-scheme: dark)');
   const follow=()=>{if(!storedTheme())applyTheme(query.matches?'dark':'light',false);};
   follow();query.addEventListener('change',follow);return()=>query.removeEventListener('change',follow);
  },[]);
  return <QueryClientProvider client={client}><TableLabels/>{children}</QueryClientProvider>;
}
