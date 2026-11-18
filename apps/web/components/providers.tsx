'use client';
import {useEffect,useState} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
export function Providers({children}:{children:React.ReactNode}) {
  const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false,staleTime:15000,refetchOnWindowFocus:false}}}));
  useEffect(()=>{document.documentElement.dataset.theme=localStorage.getItem('cw-theme')||'light';},[]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
