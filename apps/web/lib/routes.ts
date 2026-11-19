import type {Role} from './model';
export interface Destination{slug:string;name:string;group:string;icon:string}
export const customer:Destination[]=[
 {slug:'',name:'Overview',group:'Workspace',icon:'home'},
 {slug:'profile',name:'Financial profile',group:'Workspace',icon:'wallet'},
 {slug:'credit',name:'Credit health',group:'Workspace',icon:'credit'},
 {slug:'market',name:'Loan marketplace',group:'Borrowing',icon:'market'},
 {slug:'applications',name:'Loan applications',group:'Borrowing',icon:'application'},
 {slug:'loans',name:'My loans',group:'Borrowing',icon:'loans'},
 {slug:'repayments',name:'Repayments',group:'Borrowing',icon:'calendar'},
 {slug:'recovery',name:'Recovery roadmap',group:'Borrowing',icon:'stress'},
 {slug:'calculator',name:'Loan calculator',group:'Borrowing',icon:'planner'},
 {slug:'safety',name:'Loan safety scanner',group:'Borrowing',icon:'safety'},
 {slug:'twin',name:'Credit score twin',group:'Planning',icon:'twin'},
 {slug:'debt',name:'Debt freedom',group:'Planning',icon:'debt'},
 {slug:'stress',name:'Stress test',group:'Planning',icon:'stress'},
 {slug:'education',name:'Education planner',group:'Planning',icon:'education'},
 {slug:'compare',name:'Compare loans',group:'Borrowing',icon:'comparison'},
 {slug:'distress',name:'Wellbeing check',group:'Learn & support',icon:'wellbeing'},
 {slug:'academy',name:'Financial academy',group:'Learn & support',icon:'academy'},
 {slug:'rewards',name:'Rewards',group:'Learn & support',icon:'rewards'},
 {slug:'disputes',name:'Support & disputes',group:'Learn & support',icon:'support'},
 {slug:'notifications',name:'Notifications',group:'Account',icon:'alerts'},
 {slug:'reports',name:'My reports',group:'Account',icon:'reports'},
 {slug:'kyc',name:'Identity verification',group:'Account',icon:'identity'},
 {slug:'settings',name:'Settings & security',group:'Account',icon:'settings'}
];
export const admin:Destination[]=[
 {slug:'',name:'Executive overview',group:'Operations',icon:'home'},
 {slug:'applications',name:'Underwriting queue',group:'Operations',icon:'application'},
 {slug:'loans',name:'Loan portfolio',group:'Operations',icon:'loans'},
 {slug:'repayments',name:'Repayment monitoring',group:'Operations',icon:'calendar'},
 {slug:'disputes',name:'Support tickets',group:'Operations',icon:'support'},
 {slug:'distress',name:'Distress watch',group:'Governance',icon:'wellbeing'},
 {slug:'fairness',name:'Fairness monitor',group:'Governance',icon:'fairness'},
 {slug:'fraud',name:'Fraud review',group:'Governance',icon:'fraud'},
 {slug:'reports',name:'Portfolio reports',group:'Governance',icon:'reports'},
 {slug:'policy',name:'Scoring policy',group:'Governance',icon:'policy'},
 {slug:'products',name:'Product configuration',group:'Governance',icon:'market'},
 {slug:'users',name:'Customers',group:'Operations',icon:'users'},
 {slug:'kyc',name:'KYC reviews',group:'Operations',icon:'identity'},
 {slug:'settings',name:'Settings & security',group:'Account',icon:'settings'}
];
export const destinations=(role:Role)=>role==='admin'?admin:customer;
export const baseFor=(role:Role)=>role==='admin'?'/admin':'/app';
