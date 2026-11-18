'use client';
import type {User} from '@/lib/model';
import {Overview,AdminOverview} from './overview';
import {ProfilePage,KycPage,SettingsPage,AdminIdentityPage} from './identity-forms';
export function WorkspaceContent({user,slug}:{user:User;slug:string;parts:string[]}){
 if(slug==='settings')return <SettingsPage/>;
 if(user.role==='admin'){if(slug==='kyc'||slug==='users')return <AdminIdentityPage kind={slug}/>;return <AdminOverview/>;}
 if(slug==='profile')return <ProfilePage/>;if(slug==='kyc')return <KycPage/>;
 return <Overview user={user}/>;
}
