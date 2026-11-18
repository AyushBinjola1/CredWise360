export interface User{id:number;name:string;email:string;role:'customer'|'admin';active?:boolean}
export interface FinancialProfile{salary:number;business_income:number;other_income:number;essential:number;discretionary:number;savings:number;existing_emi:number;debt:number;assets:number;liabilities:number;reserves:number;employment:string;stability_months:number;credit_months:number;utilization:number;on_time:number;missed:number;income_regularity:number|null;rent:number|null;utilities:number|null;consent:boolean;savings_reported:boolean;emi_reported:boolean;goal:string;goal_amount:number}
export interface Metrics{income:number;expenses:number;disposable:number;net_worth:number;savings_rate:number|null;dti:number|null;emi_ratio:number|null;coverage:number|null;health:number|null}
export interface ProfileResult{profile:FinancialProfile;metrics:Metrics}
export type Role=User['role'];
