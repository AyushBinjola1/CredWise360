import {NextRequest} from 'next/server';
export const dynamic='force-dynamic';
async function forward(req: NextRequest,{params}:{params:Promise<{route:string[]}>}){
 const {route}=await params;
 if(route.some(part=>!/^[-a-zA-Z0-9_]+$/.test(part))) return Response.json({error:{code:'route',message:'Invalid path.'}},{status:400});
 const base=process.env.CORE_URL||'http://127.0.0.1:8787';
 const headers=new Headers();
 for(const key of ['content-type','cookie','origin','x-credwise-action','idempotency-key']){const v=req.headers.get(key);if(v)headers.set(key,v);}
 const visitor=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim();
 if(visitor)headers.set('x-credwise-client-ip',visitor);
 try{
   const payload=req.method==='GET'?undefined:await req.text();
   if(payload&&Buffer.byteLength(payload)>600*1024)return Response.json({error:{code:'size',message:'File or form is too large.'}},{status:413});
   const upstream=await fetch(base+'/api/'+route.join('/')+req.nextUrl.search,{method:req.method,headers,body:payload,cache:'no-store',signal:AbortSignal.timeout(15000),redirect:'error'});
   const pass=new Headers({'content-type':upstream.headers.get('content-type')||'application/json','cache-control':'no-store'});
   const cookie=upstream.headers.get('set-cookie');if(cookie)pass.set('set-cookie',cookie);
   return new Response(upstream.body,{status:upstream.status,headers:pass});
 }catch{return Response.json({error:{code:'service_unavailable',message:'The lending service is temporarily unavailable. Please retry.'}},{status:503});}
}
export {forward as GET,forward as POST,forward as PUT,forward as PATCH};
