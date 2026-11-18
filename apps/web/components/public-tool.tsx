import {PublicFooter} from './public-footer';import {PublicHeader} from './public-header';
export function PublicTool({children}:{children:React.ReactNode}){return <><PublicHeader/><main id="main" className="wrap publictool market-public">{children}</main><PublicFooter/></>;}
