import type { Metadata } from 'next';
import '@fontsource-variable/geist';
import './globals.css';
import {Providers} from '@/components/providers';
export const metadata: Metadata={title:{default:'CredWise 360 | Borrow with clarity',template:'%s | CredWise 360'},description:'A responsible lending studio for exploring credit, comparing loans and planning a debt-free future with synthetic financial data.'};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en" suppressHydrationWarning><body><a className="skip" href="#main">Skip to content</a><Providers>{children}</Providers></body></html>;
}
