import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText);
}
const base='../src/features/cancel-order/';
const clientUrl=moduleUrl('../src/shared/api/client.ts');
const apiUrl=moduleUrl(`${base}api/cancel-order.ts`,{zod:import.meta.resolve('zod'),'@/shared/api/client':clientUrl});
const {cancelOrder,cancelOrders}=await import(apiUrl);
const {useCancelOrder}=await import(moduleUrl(`${base}model/use-cancel-order.ts`,{
  react:import.meta.resolve('react'),'@tanstack/react-query':import.meta.resolve('@tanstack/react-query'),
  '@/shared/api/client':clientUrl,'../api/cancel-order':apiUrl,
  '@/entities/order/model/order-query-keys':moduleUrl('../src/entities/order/model/order-query-keys.ts'),
}));
const member={id:7};
const order={orderId:51,status:'CREATED',cancellationPending:false,totalAmount:5400};
const cancelled={orderId:51,orderStatus:'CANCELLED',inventoryStatus:'NOT_RESERVED',pending:false};
const pending={...cancelled,orderStatus:'CREATED',inventoryStatus:'REVIEW_REQUIRED',pending:true};
const paid={...cancelled,orderStatus:'PAID',inventoryStatus:'CONFIRMED'};
function client(){const c=new QueryClient({defaultOptions:{queries:{gcTime:Infinity},mutations:{gcTime:Infinity}}});
  c.setQueryData(['me'],member);c.setQueryData(['orders',7,51],order);c.setQueryData(['orders',7,'list',0],{content:[order]});return c;}
function hook(c){let value;function Probe(){value=useCancelOrder(7,51);return null;}
  renderToString(React.createElement(QueryClientProvider,{client:c},React.createElement(Probe)));return value;}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

test('admin cancellation posts to the admin order endpoint',async t=>{
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(new URL(url).pathname,'/api/admin/orders/51/cancel');
    assert.equal(init.method,'POST');
    assert.equal(init.body,JSON.stringify({reason:'재고 오류'}));
    return Response.json(cancelled);
  });
  assert.deepEqual(await cancelOrder(51,false,'재고 오류',true),cancelled);
});

test('bulk cancellation posts selected orders and reports each result',async t=>{
  const body={results:[
    {orderId:51,succeeded:true,orderStatus:'CANCELLED',pending:false,code:null,message:null},
    {orderId:52,succeeded:false,orderStatus:null,pending:null,code:'ORDER_CANCELLATION_IN_TRANSIT',message:'배송 중인 주문은 직접 취소할 수 없습니다. 배송 관련 문의를 해 주세요.'},
  ]};
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(new URL(url).pathname,'/api/admin/orders/cancellations');
    assert.equal(init.method,'POST');
    assert.equal(init.body,JSON.stringify({orderIds:[51,52],reason:'재고 오류'}));
    return Response.json(body);
  });
  assert.deepEqual(await cancelOrders([51,52,51],'  재고 오류  '),body);
  t.mock.restoreAll();
  t.mock.method(globalThis,'fetch',async()=>Response.json({results:[body.results[0]]}));
  await assert.rejects(cancelOrders([51,52]),/선택 취소 결과를 확인하지 못했습니다/);
});

test('cancellation sends an authenticated POST without deleting the order',async t=>{
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(new URL(url).pathname,'/api/orders/51/payments/cancel');
    assert.equal(init.method,'POST');assert.equal(init.credentials,'include');assert.equal(init.body,undefined);
    return Response.json(cancelled);
  });
  assert.deepEqual(await cancelOrder(51),cancelled);
});

test('API accepts pending and paid outcomes but rejects mismatched or contradictory outcomes',async t=>{
  for(const value of [pending,paid,{...cancelled,inventoryStatus:"LEGACY"}]){
    t.mock.method(globalThis,'fetch',async()=>Response.json(value,{status:value.pending?202:200}));
    assert.deepEqual(await cancelOrder(51),value);t.mock.restoreAll();
  }
  for(const value of [{...cancelled,orderId:52},{...cancelled,pending:true},{...pending,pending:false},{...paid,inventoryStatus:'RELEASED'},{}]){
    t.mock.method(globalThis,'fetch',async()=>Response.json(value));
    await assert.rejects(cancelOrder(51),/취소 결과를 확인하지 못했습니다/);t.mock.restoreAll();
  }
});

test('success retains the cached record and updates detail and list state',async t=>{
  const c=client();t.mock.method(globalThis,'fetch',async()=>Response.json(cancelled));
  await hook(c).submit();
  assert.deepEqual(c.getQueryData(['orders',7,51]),{...order,status:'CANCELLED',inventoryStatus:'NOT_RESERVED'});
  assert.equal(c.getQueryState(['orders',7,'list',0]).isInvalidated,true);
});

test('uncertain cancellation preserves CREATED and paid race preserves PAID',async t=>{
  for(const value of [pending,paid]){
    const c=client();t.mock.method(globalThis,'fetch',async()=>Response.json(value));
    await hook(c).submit();
    assert.equal(c.getQueryData(['orders',7,51]).status,value.orderStatus);
    assert.equal(c.getQueryData(['orders',7,51]).cancellationPending,value.pending);
    t.mock.restoreAll();
  }
});

test('rapid clicks across hook instances send only one cancellation',async t=>{
  const c=client(),started=deferred(),response=deferred();let calls=0;
  t.mock.method(globalThis,'fetch',()=>{calls++;started.resolve();return response.promise;});
  const first=hook(c);const task=first.submit();await started.promise;
  await Promise.all([first.submit(),hook(c).submit()]);assert.equal(calls,1);
  response.resolve(Response.json(cancelled));await task;
});

test('cancellation cannot run while the same order payment is in flight',async t=>{
  const c=client(),started=deferred(),release=deferred();
  const payment=c.getMutationCache().build(c,{mutationKey:['request-payment',7,51],mutationFn:()=>{started.resolve();return release.promise;}});
  const task=payment.execute();await started.promise;
  const fetch=t.mock.method(globalThis,'fetch',()=>{throw new Error('must not send');});
  try {await hook(c).submit();assert.equal(fetch.mock.callCount(),0);}
  finally {release.resolve();await task;}
});

test('late cancellation after account switch cannot update either account',async t=>{
  const c=client(),started=deferred(),response=deferred();
  t.mock.method(globalThis,'fetch',()=>{started.resolve();return response.promise;});
  const task=hook(c).submit();await started.promise;c.setQueryData(['me'],{id:8});
  response.resolve(Response.json(cancelled));await task;
  assert.deepEqual(c.getQueryData(['orders',7,51]),order);
  assert.equal(c.getQueryData(['orders',8,51]),undefined);
});

test('lost response does not claim cancellation and does not retry automatically',async t=>{
  const c=client();let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;throw new TypeError('lost response');});
  await hook(c).submit();assert.equal(calls,1);assert.equal(c.getQueryData(['orders',7,51]).status,'CREATED');
  assert.equal(c.getMutationCache().getAll()[0].state.status,'error');
});

test('401 clears the session and private order caches',async t=>{
  const c=client();t.mock.method(globalThis,'fetch',async()=>Response.json({detail:'로그인 필요'},{status:401}));
  await hook(c).submit();assert.equal(c.getQueryData(['me']),null);assert.equal(c.getQueryData(['orders',7,51]),undefined);
});

const reactImports={react:import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime')};
const deadlineUrl=moduleUrl('../src/entities/order/ui/payment-deadline.tsx',reactImports);
const stateUrl=dataUrl('export let state={isPending:false};export const setState=x=>state=x;export const useCancelOrder=()=>state;');
const {setState}=await import(stateUrl);
const dialogUrl=moduleUrl('../src/shared/ui/dialog.tsx',reactImports);
const {CancelOrderButton}=await import(moduleUrl(`${base}ui/cancel-order-button.tsx`,{
  ...reactImports,'../model/use-cancel-order':stateUrl,'@/shared/ui/dialog':dialogUrl,
  '@/shared/ui/confirm-dialog':moduleUrl('../src/shared/ui/confirm-dialog.tsx',{...reactImports,'./dialog':dialogUrl}),
}));
const render=value=>renderToStaticMarkup(React.createElement(CancelOrderButton,{order:value,memberId:7}));

test('compact admin cancel hides guidance and only shows the action',()=>{
  setState({isPending:false});
  const html=renderToStaticMarkup(React.createElement(CancelOrderButton,{order:{...order,status:'PAID',deliveryStatus:'PREPARING'},memberId:7,admin:true,compact:true}));
  assert.match(html,/>주문 취소<\/button>/);
  const shipped=renderToStaticMarkup(React.createElement(CancelOrderButton,{order:{...order,status:'PAID',deliveryStatus:'OUT_FOR_DELIVERY'},memberId:7,admin:true,compact:true}));
  assert.equal(shipped,'');
});

test('unpaid and preparing paid orders offer cancellation; shipping stages only show guidance',()=>{
  setState({isPending:false});assert.match(render(order),/>주문 취소<\/button>/);
  assert.equal(render({...order,status:'CANCELLED'}),'');
  assert.match(render({...order,status:'PAID',deliveryStatus:'PREPARING'}),/>주문 취소<\/button>/);
  for(const [deliveryStatus, message] of [['OUT_FOR_DELIVERY','배송 중인 주문은 직접 취소'],['DELIVERED','반품·환불 절차'],[null,'배송 상태를 확인하지 못했습니다']]) {
    const view=render({...order,status:'PAID',deliveryStatus});
    assert.ok(!view.includes('>주문 취소</button>'));assert.ok(view.includes(message));
  }
  setState({isPending:false,data:pending});const html=render({...order,cancellationPending:true});
  assert.match(html,/주문 취소를 처리하고 있습니다/);assert.ok(!html.includes('취소 상태 다시 확인'));
  assert.ok(!html.includes('role="dialog"'));
  const resolved=render({...order,status:'PAID'});
  assert.ok(!resolved.includes('주문 취소됨'));
  assert.ok(!resolved.includes('주문을 취소했습니다'));
});

test('cancelled orders display cancellation in detail and history',async()=>{
  const {OrderDetails}=await import(moduleUrl('../src/entities/order/ui/order-details.tsx',{...reactImports,'./payment-deadline':deadlineUrl}));
  const {OrderHistory}=await import(moduleUrl('../src/entities/order/ui/order-history.tsx',{
    ...reactImports,'./payment-deadline':deadlineUrl,'next/link':dataUrl(`import React from '${import.meta.resolve('react')}';export default function Link({children,...props}){return React.createElement('a',props,children);}`),
  }));
  const value={...order,status:'CANCELLED',items:[],itemsTotal:2400,shippingFee:3000,delivery:{recipientName:'테스트',phone:'01012345678',postalCode:'12345',address:'서울',addressDetail:''},createdAt:'2026-11-04T00:00:00Z'};
  const detail=renderToStaticMarkup(React.createElement(OrderDetails,{order:value}));
  assert.match(detail,/주문 취소/);
  assert.ok(!detail.includes('입력하지 않음'));
  assert.match(renderToStaticMarkup(React.createElement(OrderDetails,{order:{...value,cancellationReason:'중복 주문'}})),/취소 사유/);
  const history=renderToStaticMarkup(React.createElement(OrderHistory,{orders:[value]}));
  assert.match(history,/주문 취소/);assert.ok(!history.includes('주문 접수 · 결제 전'));
  assert.match(renderToStaticMarkup(React.createElement(OrderHistory,{orders:[{...value,cancellationReason:'결제 시간이 지나 주문을 취소했다'}]})),/결제 시간이 지나 주문을 취소했다/);
});


test('pending cancellation displays one notice without manual recheck or false completion',()=>{
  const value={...paid,pending:true};
  setState({isPending:false,data:value});
  const html=render({...order,status:'PAID',deliveryStatus:'PREPARING',cancellationPending:true});
  assert.match(html,/주문 취소를 처리하고 있습니다/);
  assert.ok(!html.includes('취소 상태 다시 확인'));assert.ok(!html.includes('주문 취소됨'));
});

test('API accepts pending paid cancellations and rejects pending cancelled orders',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({...paid,pending:true},{status:202}));
  assert.equal((await cancelOrder(51)).pending,true);
  t.mock.restoreAll();
  t.mock.method(globalThis,'fetch',async()=>Response.json({...cancelled,pending:true}));
  await assert.rejects(cancelOrder(51),/취소 결과를 확인하지 못했습니다/);
});
