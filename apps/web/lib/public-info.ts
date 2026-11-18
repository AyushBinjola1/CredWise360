export const information={
 about:{title:'About CredWise',intro:'CredWise 360 is a local lending studio for learning how credit decisions and repayment plans work.',sections:[
 ['A working lending ecosystem','A borrower and an administrator share one simulated portfolio. Profile edits, applications, decisions and repayments are saved in a local PostgreSQL database.'],
 ['Responsible by design','Every estimate uses explicit rules. Financial evidence, affordability and the ability to sustain monthly payments carry separate explanations.'],
 ['Built for the classroom','The project brings C++ domain models, database transactions and a responsive web workspace together in a hands-on demonstration.']]},
 'how-it-works':{title:'How it works',intro:'Follow a loan from the first budget check to the last repayment.',sections:[
 ['Build a financial profile','Enter synthetic income, expenses, monthly commitments and reserves. Review your disposable income before exploring products.'],
 ['Review your borrowing options','Use the cost estimate and the repayment schedule to decide whether a loan meets your stated need.'],
 ['Follow the decision','Submit an application and track its review. An administrator can approve, request information or explain a rejection.'],
 ['Manage repayment','Review each simulated transaction and your remaining balance. Compare extra payments and monitor progress toward closure.']]},
 features:{title:'Inside the studio',intro:'Explore how each part of the lending lifecycle connects to your financial profile.',sections:[
 ['Financial profile and credit health','See cash flow alongside an explainable simulated score. Each assessment shows the factors used to reach it.'],
 ['Scenario planning','Explore changes to income, expenses and debt in a private digital twin.'],
 ['Responsible borrowing','Compare total costs, check an external offer, plan education expenses and prioritize repayment.'],
 ['Operations workspace','A separate administrator role reviews identity submissions, applications, disputes and portfolio activity.']]},
 resources:{title:'Financial literacy resources',intro:'Learn the terms you will encounter when comparing and repaying a loan.',sections:[
 ['EMI and amortization','An equated monthly instalment combines interest and principal. An amortization schedule shows how much of each payment reduces the balance.'],
 ['Debt-to-income ratio','Compare outstanding debt with annual income. Also check monthly EMI obligations against monthly income to understand immediate pressure.'],
 ['Credit utilization','Utilization is the share of available revolving credit already in use. It is one input in the studio’s simulated score.'],
 ['Moratorium','During a repayment pause, interest may still build up. The education planner shows the effect of paying that interest during study.']]},
 faq:{title:'Frequently asked questions',intro:'Answers for students, borrowers and evaluators exploring the local demo.',sections:[
 ['Is this a real loan application?','All loans, identity checks, approvals, disbursements and repayments in CredWise are simulated. Use fictional information throughout.'],
 ['Where is my data stored?','The local C++ service writes your records to PostgreSQL. Your browser receives a session cookie after sign-in.'],
 ['What does the score represent?','The 300–900 simulated score explains the project’s configured educational policy. It is independent of a credit bureau.'],
 ['How do I try the two roles?','The sign-in page can fill a synthetic borrower or administrator account. Sign out before switching roles.'],
 ['How do I recover my account?','Save the recovery code shown when you register. Use it with your email address on the account recovery page.']]},
 privacy:{title:'Privacy information',intro:'Use synthetic names, addresses, documents and financial values in this local demonstration.',sections:[
 ['Information stored','The local database stores account details, financial inputs, synthetic verification records, applications, payments and audit events. Passwords and recovery credentials are hashed.'],
 ['Workspace access','Your customer session controls access to your records. Administrators can see the records needed for review and support.'],
 ['Browser storage','The browser holds a session cookie and local interface preferences. Signing out ends the current session.'],
 ['Account controls','Use Settings & security to update preferences and manage account access. Keep the local database and its backups under your control.']]},
 terms:{title:'Terms of use',intro:'CredWise is an educational simulation intended for a local classroom or portfolio demonstration.',sections:[
 ['Use fictional information','Use the supplied demo accounts or create a synthetic account. Upload only the supported synthetic fixtures.'],
 ['Educational decisions','Product terms, review decisions and projected outcomes describe the simulation. A real borrowing decision requires the actual lender’s disclosures.'],
 ['Local operation','The operator manages access to the local machine, its database and demonstration credentials.']]},
 simulation:{title:'Simulation disclaimer',intro:'CredWise 360 demonstrates a lending lifecycle using fictional products and records.',sections:[
 ['Simulated credit scores','Scores use configurable, deterministic rules. They are educational assessments and have no connection to a credit bureau or trained predictive model.'],
 ['Illustrative costs','Rates, fees, penalties, income and forecasts are demonstration inputs. Review the assumptions and payment schedule for each result.'],
 ['Synthetic payments and identity','A disbursement or repayment records a local database event. There is no transfer of money, live bank connection or official identity verification.']]}
} satisfies Record<string,{title:string;intro:string;sections:string[][]}>;
