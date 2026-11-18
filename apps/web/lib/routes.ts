import type {Role} from './model';
export interface Destination{slug:string;name:string;group:string;icon:string}
export const customer:Destination[]=[
 {slug:'',name:'Overview',group:'Workspace',icon:'home'},
 {slug:'profile',name:'Financial profile',group:'Workspace',icon:'wallet'},
 {slug:'credit',name:'Credit health',group:'Workspace',icon:'credit'},
 {slug:'market',name:'Loan marketplace',group:'Borrowing',icon:'market'},
 {slug:'calculator',name:'Loan calculator',group:'Borrowing',icon:'planner'},
 {slug:'compare',name:'Compare loans',group:'Borrowing',icon:'comparison'},
 {slug:'kyc',name:'Identity verification',group:'Account',icon:'identity'},
 {slug:'settings',name:'Settings & security',group:'Account',icon:'settings'}
];
export const admin:Destination[]=[
 {slug:'',name:'Executive overview',group:'Operations',icon:'home'},
 {slug:'policy',name:'Scoring policy',group:'Governance',icon:'policy'},
 {slug:'products',name:'Product configuration',group:'Governance',icon:'market'},
 {slug:'users',name:'Customers',group:'Operations',icon:'users'},
 {slug:'kyc',name:'KYC reviews',group:'Operations',icon:'identity'},
 {slug:'settings',name:'Settings & security',group:'Account',icon:'settings'}
];
export const destinations=(role:Role)=>role==='admin'?admin:customer;
export const baseFor=(role:Role)=>role==='admin'?'/admin':'/app';
