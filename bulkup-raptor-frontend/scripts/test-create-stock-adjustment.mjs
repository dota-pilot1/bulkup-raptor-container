import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let {outputText} = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  });
  for(const [name,target] of Object.entries(imports)) outputText=outputText.replaceAll(`"${name}"`,`"${target}"`);
  return dataUrl(outputText);
}
const clientUrl=moduleUrl('../src/shared/api/client.ts');
const createUrl=moduleUrl('../src/entities/inventory/api/create-stock-adjustment.ts',{'@/shared/api/client':clientUrl});
const getUrl=moduleUrl('../src/entities/inventory/api/get-stock-adjustments.ts',{'@/shared/api/client':clientUrl});
const {createStockAdjustment}=await import(createUrl);
const {ApiError}=await import(clientUrl);
const validationUrl=moduleUrl('../src/features/adjust-stock/model/validate-stock-adjustment.ts',{zod:import.meta.resolve('zod')});
const {validateStockAdjustment}=await import(validationUrl);
const hookUrl=moduleUrl('../src/features/adjust-stock/model/use-stock-adjustment.ts',{
  react:import.meta.resolve('react'),'@tanstack/react-query':import.meta.resolve('@tanstack/react-query'),
  '@/entities/inventory/api/create-stock-adjustment':createUrl,'@/entities/inventory/api/get-stock-adjustments':getUrl,
  '@/entities/session':dataUrl('export function hasPermission(member,code){return member?.permissions.includes(code)??false}'),
  '@/shared/api/client':clientUrl,
});
const {useStockAdjustment}=await import(hookUrl);
const product={id:670,name:'상품',stockQuantity:10};
const saved={id:1,productId:670,actorId:8,actorName:'운영자',type:'DECREASE',delta:-3,beforeQuantity:10,afterQuantity:7,reason:'파손',createdAt:'2026-11-04T08:00:00Z'};
const page={content:[saved],page:0,size:10,totalElements:1,totalPages:1};
const request={delta:-3,reason:'파손'};
function client(){
  const c=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity},mutations:{gcTime:Infinity}}});
  c.setQueryData(['me'],{id:8,permissions:['MENU_ADMIN_ACCESS','PRODUCT_MANAGE']});
  c.setQueryData(['products'],[product,{id:671,stockQuantity:20}]);
  c.setQueryData(['inventory-product',670],product);
  return c;
}
function hook(c,refresh=()=>{}){
  let result;
  function Probe(){result=useStockAdjustment(670,8,refresh);return null}
  renderToString(React.createElement(QueryClientProvider,{client:c},React.createElement(Probe)));
  return result;
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};}

test('POST sends only delta and reason with the selected product ID and session cookie',async t=>{
  t.mock.method(globalThis,'fetch',async(path,init)=>{
    assert.equal(new URL(path).pathname,'/api/admin/products/670/stock-adjustments');
    assert.equal(init.method,'POST'); assert.equal(init.credentials,'include');
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.headers.get('Content-Type'),'application/json');
    assert.deepEqual(JSON.parse(init.body),request);
    return Response.json(saved,{status:201});
  });
  assert.deepEqual(await createStockAdjustment(670,{...request,actorId:999}),saved);
});
test('API retains status and business code',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({code:'STOCK_INSUFFICIENT',detail:'재고 부족'},{status:409}));
  await assert.rejects(createStockAdjustment(670,request),e=>e instanceof ApiError&&e.status===409&&e.code==='STOCK_INSUFFICIENT');
});
test('validation signs delta, trims reason, and handles zero and maximum stock',()=>{
  assert.deepEqual(validateStockAdjustment('decrease','3','  파손  ',10),{valid:true,request,afterQuantity:7});
  assert.equal(validateStockAdjustment('decrease','10','폐기',10).afterQuantity,0);
  assert.equal(validateStockAdjustment('increase','2147483647','x'.repeat(200),0).afterQuantity,2147483647);
  for(const amount of ['','0','-1','1.5','1.0','1e3',' 3','3 ','NaN','2147483648','99999999999999999999']){
    assert.equal(validateStockAdjustment('increase',amount,'사유',10).valid,false,amount);
  }
  for(const reason of ['',' ','\u2003','x'.repeat(201)]) assert.equal(validateStockAdjustment('increase','1',reason,10).valid,false);
  assert.equal(validateStockAdjustment('decrease','11','사유',10).valid,false);
  assert.equal(validateStockAdjustment('increase','1','사유',2147483647).valid,false);
});
test('success updates only the submitted product and requests first-page history',async t=>{
  const c=client();const refresh=[];const calls=[];
  t.mock.method(globalThis,'fetch',async(path,init)=>{calls.push({path:new URL(path),init});return Response.json(init.method==='POST'?saved:page)});
  assert.deepEqual(await hook(c,id=>refresh.push(id)).save(request),{status:'saved',refreshFailed:false});
  assert.deepEqual(refresh,[670]);
  assert.equal(c.getQueryData(['products'])[0].stockQuantity,7);
  assert.equal(c.getQueryData(['products'])[1].stockQuantity,20);
  assert.equal(c.getQueryData(['inventory-product',670]).stockQuantity,7);
  assert.equal(c.getQueryData(['inventory-history',8,670,0,10]).content[0].id,1);
  assert.equal(calls.filter(x=>x.init.method==='POST').length,1);
  assert.equal(calls[1].path.search,'?page=0&size=10');
  c.clear();
});
test('rapid clicks and separate hook instances send one POST',async t=>{
  const c=client(),wait=deferred(),started=deferred();let posts=0;
  t.mock.method(globalThis,'fetch',async(_path,init)=>{
    if(init.method==='POST'){posts++;started.resolve();return wait.promise;}return Response.json(page);
  });
  const first=hook(c),second=hook(c);const saving=first.save(request);await started.promise;
  assert.equal((await first.save(request)).status,'ignored');
  assert.equal((await second.save(request)).status,'ignored');
  wait.resolve(Response.json(saved));await saving;
  assert.equal(posts,1);c.clear();
});
test('401, 403, 404 and 400 preserve inputs by returning a rejection outcome',async t=>{
  const c=client();
  for(const status of [401,403,404,400]){
    t.mock.method(globalThis,'fetch',async()=>Response.json({detail:'입력 오류'},{status}));
    assert.equal((await hook(c).save(request)).status,'rejected');
    assert.equal(c.getQueryData(['inventory-product',670]).stockQuantity,10);
  }
  c.clear();
});
test('409 refreshes current data without automatically repeating the POST',async t=>{
  const c=client();let posts=0;let refreshed=0;
  t.mock.method(globalThis,'fetch',async(_path,init)=>{if(init.method==='POST'){posts++;return Response.json({detail:'재고 부족'},{status:409})}return Response.json(page)});
  const result=await hook(c,()=>refreshed++).save(request);
  assert.equal(result.status,'rejected');assert.match(result.message,/최신 재고/);
  assert.equal(refreshed,1);assert.equal(posts,1);c.clear();
});
test('saved POST with failed refresh is still saved and never resubmitted',async t=>{
  const c=client();let posts=0;
  t.mock.method(globalThis,'fetch',async(_path,init)=>{if(init.method==='POST'){posts++;return Response.json(saved)}throw new TypeError('offline')});
  assert.deepEqual(await hook(c).save(request),{status:'saved',refreshFailed:true});
  assert.equal(posts,1);assert.equal(c.getQueryData(['inventory-product',670]).stockQuantity,7);c.clear();
});
test('uncertain save can be reviewed with GET only; failed review remains blocked',async t=>{
  const c=client();let fail=true;let posts=0;
  t.mock.method(globalThis,'fetch',async(_path,init)=>{if(init.method==='POST'){posts++;throw new TypeError('timeout')}if(fail)throw new TypeError('offline');return Response.json(page)});
  const h=hook(c);assert.equal((await h.save(request)).status,'uncertain');
  assert.deepEqual(await h.review(),{status:'reviewed',refreshFailed:true});
  fail=false;assert.deepEqual(await h.review(),{status:'reviewed',refreshFailed:false});
  assert.equal(posts,1);c.clear();
});
test('late success after account change does not change new account state',async t=>{
  const c=client(),wait=deferred(),started=deferred();let refreshed=0;
  t.mock.method(globalThis,'fetch',async()=>{started.resolve();return wait.promise});
  const saving=hook(c,()=>refreshed++).save(request);await started.promise;
  c.setQueryData(['me'],{id:9,permissions:['PRODUCT_MANAGE']});
  wait.resolve(Response.json(saved));assert.equal((await saving).status,'ignored');
  assert.equal(refreshed,0);assert.equal(c.getQueryData(['inventory-product',670]).stockQuantity,10);c.clear();
});
test('viewer cannot submit and older queries are cancelled before saved stock is applied',async t=>{
  const c=client();c.setQueryData(['me'],{id:8,permissions:['MENU_ADMIN_ACCESS']});
  const fetch=t.mock.method(globalThis,'fetch',async()=>{throw Error('unexpected')});
  assert.equal((await hook(c).save(request)).status,'ignored');assert.equal(fetch.mock.callCount(),0);
  c.setQueryData(['me'],{id:8,permissions:['PRODUCT_MANAGE']});let aborted=false;const cancelled=deferred();
  const observer=new QueryObserver(c,{queryKey:['inventory-product',670],queryFn:({signal})=>new Promise((_,reject)=>{
    signal.addEventListener('abort',()=>{aborted=true;cancelled.resolve();reject(new DOMException('aborted','AbortError'))});
  })});
  const stop=observer.subscribe(()=>{});
  t.mock.method(globalThis,'fetch',async(_path,init)=>Response.json(init.method==='POST'?saved:page));
  const saving=hook(c).save(request);
  await cancelled.promise;
  stop();
  const result=await saving;assert.equal(result.status,'saved');assert.equal(aborted,true);c.clear();
});

const {createStockAdjustmentSchema}=await import(validationUrl);
const {zodResolver}=await import('@hookform/resolvers/zod');
const resolverOptions={fields:{},shouldUseNativeValidation:false};

test('Zod collects quantity and reason errors together, including insufficient stock',()=>{
  let result=validateStockAdjustment('decrease','11','',10);
  assert.equal(result.valid,false);
  assert.match(result.fieldErrors.quantity,/현재 재고/);
  assert.match(result.fieldErrors.reason,/1자 이상/);
  result=validateStockAdjustment('increase','0','x'.repeat(201),10);
  assert.match(result.fieldErrors.quantity,/1개 이상/);
  assert.match(result.fieldErrors.reason,/200자 이하/);
});
test('real Zod resolver maps errors to fields and trims a valid reason',async()=>{
  const resolver=zodResolver(createStockAdjustmentSchema(10));
  const invalid=await resolver({direction:'decrease',quantity:'11',reason:''},undefined,resolverOptions);
  assert.ok(invalid.errors.quantity);assert.ok(invalid.errors.reason);
  const valid=await resolver({direction:'decrease',quantity:'3',reason:'  파손  '},undefined,resolverOptions);
  assert.deepEqual(valid.errors,{});
  assert.deepEqual(valid.values,{direction:'decrease',quantity:'3',reason:'파손'});
});

const formHarnessUrl=dataUrl(`import {useForm as actual,useWatch,useController} from ${JSON.stringify(import.meta.resolve('react-hook-form'))};
export {useWatch,useController};export let current;export let options;let errors;
export function inject(value){errors=value}
export function useForm(value){options=value;current=actual({...value,errors});return current}`);
const formHarness=await import(formHarnessUrl);
const stockHarnessUrl=dataUrl('export function useStockAdjustment(){return {isPending:false,save:async()=>({status:"ignored"}),review:async()=>({status:"ignored"})}}');
const {StockAdjustmentForm}=await import(moduleUrl('../src/features/adjust-stock/ui/stock-adjustment-form.tsx',{
  react:import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),
  'react-hook-form':formHarnessUrl,'@hookform/resolvers/zod':import.meta.resolve('@hookform/resolvers/zod'),
  '@/shared/ui/toast':dataUrl('export function useToast(){return {success(){},error(){}}}'),
  '../model/use-stock-adjustment':stockHarnessUrl,'../model/validate-stock-adjustment':validationUrl,
}));
function renderForm(errors){
  formHarness.inject(errors);
  return renderToString(React.createElement(StockAdjustmentForm,{productId:670,memberId:8,currentStock:10,disabled:false,onRefresh(){}}));
}
test('React Hook Form blocks invalid submissions and returns validated values',async()=>{
  renderForm();const form=formHarness.current;
  assert.equal(formHarness.options.mode,'onChange');
  let called=false;let invalid;
  await form.handleSubmit(()=>{called=true},errors=>{invalid=errors})();
  assert.equal(called,false);assert.ok(invalid.quantity);assert.ok(invalid.reason);
  form.setValue('direction','decrease');form.setValue('quantity','3');form.setValue('reason','  파손  ');
  let values;await form.handleSubmit(v=>{values=v})();
  assert.deepEqual(values,{direction:'decrease',quantity:'3',reason:'파손'});
});
test('field errors render red borders, accessible messages, and only mark the invalid field',()=>{
  let html=renderForm();assert.ok(!html.includes('border-rose-500'));
  html=renderForm({quantity:{type:'custom',message:'현재 재고보다 많이 줄일 수 없습니다.'}});
  assert.match(html,/id="stock-change-8-670-quantity"[^>]*aria-invalid="true"/);
  assert.match(html,/id="stock-change-8-670-reason"[^>]*aria-invalid="false"/);
  assert.match(html,/border-rose-500/);assert.match(html,/role="alert"/);assert.match(html,/현재 재고보다 많이/);
  html=renderForm({reason:{type:'server',message:'사유를 확인해 주세요.'}});
  assert.match(html,/id="stock-change-8-670-reason"[^>]*aria-invalid="true"/);
  assert.match(html,/reason-error/);assert.match(html,/사유를 확인/);
});
test('API and mutation preserve server field errors for React Hook Form setError',async t=>{
  const c=client();
  t.mock.method(globalThis,'fetch',async()=>Response.json({code:'INVALID_INPUT',fieldErrors:{delta:'수량 오류',reason:'사유 오류'}},{status:400}));
  const result=await hook(c).save(request);
  assert.equal(result.status,'rejected');
  assert.deepEqual(result.fieldErrors,{quantity:'수량 오류',reason:'사유 오류'});
  c.clear();
});
test('stock conflicts map to the quantity field after refreshing latest data',async t=>{
  const c=client();
  t.mock.method(globalThis,'fetch',async(_path,init)=>init.method==='POST'
    ?Response.json({code:'STOCK_INSUFFICIENT',detail:'현재 재고보다 많이 줄일 수 없습니다.'},{status:409})
    :Response.json(page));
  const result=await hook(c).save(request);
  assert.match(result.fieldErrors.quantity,/현재 재고/);c.clear();
});
