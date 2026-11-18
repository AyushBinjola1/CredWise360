'use client';
import type {User} from '@/lib/model';
import {CreditPage,PolicyPage} from './credit';
import {ProductAdmin} from './product-admin';
import {MarketplacePage,ComparePage,CalculatorPage} from './marketplace';
import {Overview,AdminOverview} from './overview';
import {ProfilePage,KycPage,SettingsPage,AdminIdentityPage} from './identity-forms';
export function WorkspaceContent({user,slug,parts}:{user:User;slug:string;parts:string[]}){
 if(slug==='settings')return <SettingsPage/>;
 if(user.role==='admin'){if(slug==='policy')return <PolicyPage/>;if(slug==='products')return <ProductAdmin/>;if(slug==='kyc'||slug==='users')return <AdminIdentityPage kind={slug}/>;return <AdminOverview/>;}
 if(slug==='credit')return <CreditPage/>;
 if(slug==='market')return <MarketplacePage signedIn slug={parts[0]}/>;
 if(slug==='calculator')return <CalculatorPage/>;
 if(slug==='compare')return <ComparePage/>;
 if(slug==='profile')return <ProfilePage/>;if(slug==='kyc')return <KycPage/>;
 return <Overview user={user}/>;
}
