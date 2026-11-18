import Link from 'next/link';import {Brand} from '@/components/brand';
export default function NotFound(){return <main id="main" className="wrap reading"><Brand/><h1>Page not found</h1><p>This address does not match a CredWise page.</p><Link className="button primary" href="/">Back to home</Link></main>;}
