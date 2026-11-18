'use client';
import {Failure} from '@/components/states';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main id="main" className="wrap reading"><h1>Workspace unavailable</h1><Failure message="We couldn’t load this page. Check your local services and retry." retry={reset}/></main>;}
