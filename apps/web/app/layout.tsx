import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/geist';
import './globals.css';
import './workspace.css';
import './public-extra.css';
import './finance.css';
import './design-system.css';
import {Providers} from '@/components/providers';
import {themeBootstrap} from '@/lib/theme';
const siteUrl=process.env.SITE_URL||'https://credwise360.onrender.com';
const title='CredWise 360 | Borrow with clarity';
const description='A responsible lending studio for exploring credit, comparing loans and planning a debt-free future with synthetic financial data.';
export const metadata: Metadata={
  metadataBase:new URL(siteUrl),
  title:{default:title,template:'%s | CredWise 360'},
  description,
  applicationName:'CredWise 360',
  authors:[{name:'Ayush Binjola'}],
  openGraph:{type:'website',siteName:'CredWise 360',title,description,url:'/',images:[{url:'/brand/og-image.png',width:1200,height:630,alt:'CredWise 360 logo'}]},
  twitter:{card:'summary_large_image',title,description,images:['/brand/og-image.png']},
};
export const viewport: Viewport={viewportFit:'cover',themeColor:[{media:'(prefers-color-scheme: light)',color:'#FAF9F6'},{media:'(prefers-color-scheme: dark)',color:'#111827'}]};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head><body><a className="skip" href="#main">Skip to content</a><Providers>{children}</Providers></body></html>;
}
