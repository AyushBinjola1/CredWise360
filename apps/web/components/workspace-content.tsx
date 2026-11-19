'use client';
import type {User} from '@/lib/model';
import {ApplicationsPage,UnderwritingPage,RecoveryPage} from './origination';
import {LoansPage} from './servicing';
import {TwinPage,DebtPage,StressPage,EducationPage} from './planning';
import {SafetyPage,DistressPage,AdminDistressPage} from './protection';
import {SupportPage,AdminSupportPage} from './support';
import {FairnessPage} from './fairness';
import {AcademyPage,RewardsPage} from './academy';
import {NotificationsPage,ReportsPage,AdminReportsPage,FraudPage} from './operations';
import {CreditPage,PolicyPage} from './credit';
import {ProductAdmin} from './product-admin';
import {MarketplacePage,ComparePage,CalculatorPage} from './marketplace';
import {Overview,AdminOverview} from './overview';
import {ProfilePage,KycPage,SettingsPage,AdminIdentityPage} from './identity-forms';
export function WorkspaceContent({user,slug,parts}:{user:User;slug:string;parts:string[]}){
 if(slug==='applications')return user.role==='admin'?<UnderwritingPage parts={parts}/>:<ApplicationsPage parts={parts}/>;
 if(slug==='loans'||slug==='repayments')return <LoansPage parts={parts} admin={user.role==='admin'} repayments={slug==='repayments'}/>;
 if(slug==='recovery')return <RecoveryPage/>;
 if(slug==='settings')return <SettingsPage/>;
 if(slug==='reports')return user.role==='admin'?<AdminReportsPage/>:<ReportsPage/>;
 if(slug==='fraud'&&user.role==='admin')return <FraudPage/>;
 if(slug==='disputes')return user.role==='admin'?<AdminSupportPage parts={parts}/>:<SupportPage parts={parts}/>;
 if(slug==='fairness'&&user.role==='admin')return <FairnessPage/>;
 if(slug==='distress')return user.role==='admin'?<AdminDistressPage/>:<DistressPage/>;
 if(user.role==='customer'){if(slug==='safety')return <SafetyPage/>;if(slug==='academy')return <AcademyPage parts={parts}/>;if(slug==='rewards')return <RewardsPage/>;}
 if(user.role==='customer'){if(slug==='notifications')return <NotificationsPage/>;if(slug==='twin')return <TwinPage/>;if(slug==='debt')return <DebtPage/>;if(slug==='stress')return <StressPage/>;if(slug==='education')return <EducationPage/>;}
 if(user.role==='admin'){if(slug==='policy')return <PolicyPage/>;if(slug==='products')return <ProductAdmin/>;if(slug==='kyc'||slug==='users')return <AdminIdentityPage kind={slug}/>;return <AdminOverview/>;}
 if(slug==='credit')return <CreditPage/>;
 if(slug==='market')return <MarketplacePage signedIn slug={parts[0]}/>;
 if(slug==='calculator')return <CalculatorPage/>;
 if(slug==='compare')return <ComparePage/>;
 if(slug==='profile')return <ProfilePage/>;if(slug==='kyc')return <KycPage/>;
 return <Overview user={user}/>;
}
