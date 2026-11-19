import Link from 'next/link';
import {ArrowDownRight,ArrowRight,BookOpen,Calculator,CheckCircle2,Compass,GraduationCap,HeartHandshake,Languages,Layers,Leaf,Scale,ShieldCheck,Target} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {PublicHeader} from '@/components/public-header';
import {PublicFooter} from '@/components/public-footer';
import './landing.css';

/** Product screenshot in a window frame. Both theme captures are present and CSS shows the one matching the active theme. */
function Shot({name,alt,priority=false}:{name:string;alt:string;priority?:boolean}){
 return <figure className="shot"><div className="shot-bar" aria-hidden="true"><i/><i/><i/></div>
  <img className="shot-light" src={`/images/showcase/${name}-light.webp`} alt={alt} width="1200" height="759" loading={priority?'eager':'lazy'} decoding="async"/>
  <img className="shot-dark" src={`/images/showcase/${name}-dark.webp`} alt={alt} width="1200" height="759" loading={priority?'eager':'lazy'} decoding="async"/></figure>;
}
function Feature({id,eyebrow,title,children,points,image,alt,flip=false,href,cta}:{id:string;eyebrow:string;title:string;children:React.ReactNode;points:string[];image:string;alt:string;flip?:boolean;href:string;cta:string}){
 return <section id={id} className={'feature wrap'+(flip?' flip':'')}><div className="feature-copy"><span className="eyebrow"><i/> {eyebrow}</span><h2>{title}</h2><p>{children}</p>
  <ul className="ticks">{points.map(p=><li key={p}><CheckCircle2 size={17} aria-hidden="true"/>{p}</li>)}</ul>
  <Link className="textlink" href={href}>{cta} <ArrowRight size={15} aria-hidden="true"/></Link></div><Shot name={image} alt={alt}/></section>;
}
const faqs:[string,string][]=[
 ['Is this a real lender?','No. CredWise 360 is an educational simulation. No real money moves, no real identity is checked and every record is synthetic.'],
 ['Where does the score come from?','A transparent, documented scoring policy running in a C++ service. It is a simulated 300 to 900 score, independent of any credit bureau, and every factor is explained.'],
 ['Can I use it without a credit history?','Yes. With your consent, rent, utility payments, savings and income consistency can be assessed instead. When evidence is thin, the case goes to a person.'],
 ['Do the planners change my records?','No. The digital twin, stress test and planners work on a copy of your profile. Only the scenarios you choose to save are stored.'],
 ['Why do I see demo accounts?','They let you explore both sides of the product: a borrower and an administrator who underwrites applications. Registering your own account keeps your data separate.'],
];

export default function Home(){
 return <><PublicHeader/><main id="main">
 <section className="wrap home-hero"><div className="hero-copy"><span className="eyebrow"><i/> Responsible lending studio</span><h1>Borrow wisely.<br/><em>Live freely.</em></h1><p>Understand your credit, explore what you can afford, and build a plan for life beyond debt.</p>
  <div className="actions"><Button asChild><Link href="/login">Open the demo <ArrowRight size={17} aria-hidden="true"/></Link></Button><Link className="textlink" href="/calculator">Try the EMI calculator <Calculator size={16} aria-hidden="true"/></Link></div>
  <div className="hero-note"><ShieldCheck size={16} aria-hidden="true"/> An educational simulation. Synthetic data, no real money.</div></div>
  <div className="hero-photo"><img src="/images/planning-at-home.webp" alt="A woman in a sage shirt writes in a notebook at a sunlit desk." fetchPriority="high" width="1536" height="1024"/><Link className="photo-caption" href="/calculator"><span className="round-icon"><Leaf size={21} aria-hidden="true"/></span><span>Monthly repayment planner<strong>Calculate your EMI ↗</strong></span></Link></div></section>

 <section className="proof wrap" aria-label="What makes CredWise different"><ul>
  <li><strong>Explainable</strong><span>Every score and decision shows its reasons</span></li>
  <li><strong>Calculated in C++</strong><span>One authoritative engine, reconciled to the paisa</span></li>
  <li><strong>Inclusive</strong><span>Alternative evidence for first-time borrowers</span></li>
  <li><strong>Hindi and English</strong><span>Financial literacy lessons in both languages</span></li></ul></section>

 <section id="product" className="showcase wrap"><div className="center"><span className="eyebrow"><i/> The product</span><h2>One place to understand, plan and manage borrowing.</h2><p>A borrower workspace that turns your own numbers into clear next steps, and an administrator workspace for underwriting, servicing and oversight.</p></div><Shot name="dashboard" alt="The CredWise borrower dashboard showing a financial health score, simulated credit score, outstanding debt, next instalment, recommended steps and recent activity." priority/></section>

 <Feature id="twin" eyebrow="Credit Score Digital Twin" title="Test a change before you make it." image="twin" alt="The credit score digital twin comparing today's simulated score with a scenario after building three months of emergency savings." href="/login" cta="Try it in the demo" points={['Six ready-made scenarios and your own what-if numbers','Factor-by-factor view of what moved the score','Runs on a copy: your saved records never change']}>Lower utilisation, build reserves, pay down debt or miss a payment, and see the simulated effect on your score and monthly capacity first.</Feature>
 <Feature id="debt" flip eyebrow="Debt Freedom Navigator" title="See the quickest, cheapest way out of debt." image="debt" alt="The debt freedom navigator comparing months to become debt-free and interest saved against paying only minimum instalments." href="/login" cta="Open the navigator" points={['Avalanche and snowball compared side by side','Months and interest saved against minimum payments','Combines your CredWise loans with any debts you add']}>Choose a monthly amount for debt and compare strategies month by month, with a clear payoff order and balance chart.</Feature>
 <Feature id="education" eyebrow="Education Loan Planner" title="Know what a degree really costs to repay." image="education" alt="The education loan planner showing the loan needed, interest added during study, EMI and the repayment outlook against expected salary." href="/login" cta="Plan an education loan" points={['Yearly disbursement and interest during the study period','Option to pay interest while studying','EMI measured against your expected salary']}>Enter the course cost, family funds and scholarships. The planner projects the balance when repayment starts and whether the EMI looks comfortable or stretched.</Feature>
 <Feature id="safety" flip eyebrow="Consumer protection" title="Check an offer before you sign it." image="safety" alt="The loan safety scanner reporting a high concern for a flat-rate offer, with the true effective annual cost, warning signs and a safe-borrowing checklist." href="/login" cta="Scan an example offer" points={['The true effective cost, including fees and charges','Explained warning signs and a safe-borrowing checklist','Flags are guidance, never an accusation against a lender']}>Enter the terms of any outside offer to see what you would actually receive and repay, and which terms deserve a question.</Feature>

 <section id="principles" className="principles"><div className="wrap"><div className="center"><span className="eyebrow"><i/> Responsible by design</span><h2>Lending that explains itself.</h2></div>
  <div className="cards3">
   <article><HeartHandshake size={26} aria-hidden="true"/><h3>Financial inclusion</h3><p>First-time borrowers can be assessed on consented evidence of rent, utility payments, savings and regular income. Limited evidence leads to a human review, not an automatic no.</p></article>
   <article><Scale size={26} aria-hidden="true"/><h3>Fair and auditable</h3><p>Protected attributes never enter scoring. A fairness monitor tests equivalent profiles, and every decision keeps a reason, a history and an audit entry.</p></article>
   <article><Target size={26} aria-hidden="true"/><h3>Recovery, not punishment</h3><p>A rejection comes with reasons and a recovery roadmap. Distress warnings offer support and never change a score. Rewards are never given for borrowing more.</p></article></div></div></section>

 <section id="guide" className="wrap steps4"><div className="center"><span className="eyebrow"><i/> How it works</span><h2>From first question to final repayment.</h2></div>
  <ol>{[['Build a profile','Enter synthetic income, spending and commitments, then verify a simulated identity.'],['Understand your options','See your score, explore eight loan products and compare the real cost.'],['Apply and be decided','Submit evidence. An underwriter reviews it and records an explained decision.'],['Repay and recover','Pay instalments, track the schedule and get a closure certificate, or a roadmap if things go wrong.']].map(([t,d],i)=><li key={t}><span className="step-no" aria-hidden="true">{i+1}</span><h3>{t}</h3><p>{d}</p></li>)}</ol></section>

 <section id="learn" className="feature wrap academy"><div className="feature-copy"><span className="eyebrow"><i/> Financial literacy</span><h2>Learn the language of credit.</h2><p>Eleven short lessons on interest, EMIs, credit scores, affordability and fraud awareness, each with a quiz and an explanation of the right answer. Available in English and Hindi, with progress that persists.</p>
  <ul className="ticks"><li><Languages size={17} aria-hidden="true"/>English and Hindi lessons</li><li><GraduationCap size={17} aria-hidden="true"/>Quizzes with explained answers</li><li><Layers size={17} aria-hidden="true"/>Points and badges for learning, never for borrowing</li></ul><Link className="textlink" href="/resources">Read the guides <ArrowRight size={15} aria-hidden="true"/></Link></div><Shot name="academy" alt="The financial literacy academy lesson list with English and Hindi language options and a progress indicator."/></section>

 <section className="notice-band"><div className="wrap"><BookOpen size={22} aria-hidden="true"/><div><h2>An educational simulation</h2><p>CredWise 360 is a learning project. It is not a lender, offers no real credit and gives no financial advice. All identities, documents and amounts are synthetic, and scores are simulated and independent of any credit bureau. <Link className="textlink" href="/simulation">Read the simulation disclaimer</Link></p></div></div></section>

 <section id="faq" className="wrap faq"><div className="center"><span className="eyebrow"><i/> Questions</span><h2>Good to know</h2></div>
  <div className="faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div><p className="center"><Link className="textlink" href="/faq">See all questions <ArrowRight size={15} aria-hidden="true"/></Link></p></section>

 <section className="cta wrap"><div><h2>Explore both sides of a loan.</h2><p>Sign in as a borrower or as an administrator and follow an application from request to repayment.</p></div><div className="actions"><Button asChild><Link href="/login">Open the demo <ArrowRight size={17} aria-hidden="true"/></Link></Button><Button asChild variant="outline"><Link href="/products">Browse loan products</Link></Button><a className="textlink" href="#product">Back to the product <ArrowDownRight size={15} aria-hidden="true"/></a></div></section>
 </main><PublicFooter/></>;
}
