import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}, suffix = '') {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText + suffix);
}
const clientUrl=moduleUrl('../src/shared/api/client.ts');
const keysUrl=moduleUrl('../src/entities/cart/model/query-keys.ts');
const orderKeysUrl=moduleUrl('../src/entities/order/model/order-query-keys.ts');
const amountsUrl=moduleUrl('../src/entities/order/model/order-amounts.ts');
const deliverySchemaUrl=moduleUrl('../src/entities/delivery/model/schema.ts',{zod:import.meta.resolve('zod')});
const schemaUrl=moduleUrl('../src/features/create-order/model/order-form-schema.ts',{zod:import.meta.resolve('zod'),'@/entities/delivery/model/schema':deliverySchemaUrl});
const storeImports={react:import.meta.resolve('react'),'./order-form-schema':schemaUrl};
const storeUrl=moduleUrl('../src/features/create-order/model/order-attempt-store.ts',storeImports);
const {readOrderAttempt,saveOrderAttempt}=await import(storeUrl);
const {orderFormSchema}=await import(schemaUrl);
const {orderAmounts}=await import(amountsUrl);
const createUrl=moduleUrl('../src/features/create-order/api/create-order.ts',{'@/shared/api/client':clientUrl});
const getCartUrl=moduleUrl('../src/entities/cart/api/get-cart.ts',{'@/shared/api/client':clientUrl});
const getOrderUrl=moduleUrl('../src/entities/order/api/get-order.ts',{'@/shared/api/client':clientUrl});
const {getOrder}=await import(getOrderUrl);
const toastUrl=dataUrl('export const messages=[]; export const useToast=()=>({error:m=>messages.push(m)});');
const {messages}=await import(toastUrl);
const {useCreateOrder}=await import(moduleUrl('../src/features/create-order/model/use-create-order.ts',{
  react:import.meta.resolve('react'),'@tanstack/react-query':import.meta.resolve('@tanstack/react-query'),
  '@/entities/cart/model/query-keys':keysUrl,'@/entities/cart/api/get-cart':getCartUrl,
  '@/entities/order/model/order-query-keys':orderKeysUrl,'@/entities/order/model/order-amounts':amountsUrl,
  '@/shared/api/client':clientUrl,'@/shared/ui/toast':toastUrl,'../api/create-order':createUrl,
  './order-form-schema':schemaUrl,'./order-attempt-store':storeUrl,
}));
const {useOrder}=await import(moduleUrl('../src/entities/order/model/use-order.ts',{
  '@tanstack/react-query':import.meta.resolve('@tanstack/react-query'),'../api/get-order':getOrderUrl,'./order-query-keys':orderKeysUrl,
}));
const member={id:7,name:'회원'};
const form={recipientName:'수령인',phone:'01012345678',postalCode:'06236',address:'서울시 테스트로',addressDetail:'101호'};
const cart={items:[{id:3,product:{id:4,name:'상품',price:1200},quantity:1,lineTotal:1200}],totalQuantity:1,totalAmount:1200};
const empty={items:[],totalQuantity:0,totalAmount:0};
const order={orderId:99,status:'CREATED',items:[{productId:4,productName:'주문 당시 상품',unitPrice:1200,quantity:1,lineTotal:1200}],itemsTotal:1200,shippingFee:3000,totalAmount:4200,delivery:form,createdAt:'2026-10-30T10:00:00Z'};
function client(session=member){
  messages.length=0;saveOrderAttempt(7,null);
  const c=new QueryClient({defaultOptions:{queries:{gcTime:Infinity},mutations:{gcTime:Infinity}}});
  c.setQueryData(['me'],session);c.setQueryData(['cart',7],cart);return c;
}
function hook(c){let result;function Probe(){result=useCreateOrder();return null;}
  renderToString(React.createElement(QueryClientProvider,{client:c},React.createElement(Probe)));return result;}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}

test('shipping estimates match the free-shipping boundary and schema trims delivery',()=>{
  assert.deepEqual([0,49999,50000].map(x=>orderAmounts(x).shippingFee),[0,3000,0]);
  assert.equal(orderFormSchema.parse({...form,recipientName:' 회원 '}).recipientName,'회원');
  for(const update of [{postalCode:'abc'},{phone:'1'},{recipientName:' '},{address:''}])
    assert.equal(orderFormSchema.safeParse({...form,...update}).success,false);
});

test('POST sends only selected IDs, normalized delivery, amount and UUID; success refreshes shared caches',async t=>{
  const c=client();let sent;const methods=[];
  c.setQueryData(['orders',7,'list',0],{content:[]});
  c.setQueryData(['orders',8,'list',0],{content:[]});
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    methods.push(init.method??'GET');assert.equal(init.credentials,'include');
    if(init.method==='POST'){
      assert.equal(new URL(url).pathname,'/api/orders');sent=JSON.parse(init.body);return Response.json(order,{status:201});
    }return Response.json(empty);
  });
  assert.deepEqual(await hook(c).submit(form,cart),order);
  assert.equal(sent.expectedTotalAmount,4200);assert.deepEqual(sent.cartItemIds,[3]);
  assert.match(sent.requestId,/^[0-9a-f-]{36}$/);assert.equal('memberId' in sent,false);assert.equal('price' in sent,false);
  assert.deepEqual(methods,['POST','GET']);assert.deepEqual(c.getQueryData(['orders',7,99]),order);
  assert.equal(c.getQueryState(['orders',7,'list',0]).isInvalidated,true);
  assert.equal(c.getQueryState(['orders',8,'list',0]).isInvalidated,false);
  assert.deepEqual(c.getQueryData(['cart',7]),empty);assert.equal(readOrderAttempt(7),null);
});

test('rapid clicks across hook instances submit once and stay locked through GET',async t=>{
  const c=client();const started=deferred();const pending=deferred();let posts=0;
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    if(init.method==='POST'){posts++;return Response.json(order);}
    started.resolve();return pending.promise;
  });
  const first=hook(c);const result=first.submit(form,cart);await started.promise;
  await Promise.all([first.submit(form,cart),hook(c).submit(form,cart)]);
  assert.equal(posts,1);assert.equal(c.isMutating({mutationKey:['cart-write']}),1);
  pending.resolve(Response.json(empty));await result;
});

test('lost response preserves exact payload and retries the same UUID even with an empty cart',async t=>{
  const c=client();const payloads=[];
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    if(init.method==='POST'){
      payloads.push(JSON.parse(init.body));
      if(payloads.length===1)throw new TypeError('lost response');
      return Response.json(order,{status:200});
    }return Response.json(empty);
  });
  assert.equal(await hook(c).submit(form,cart),null);
  assert.ok(readOrderAttempt(7));
  assert.deepEqual(await hook(c).submit({...form,address:'변경된 입력'},empty),order);
  assert.deepEqual(payloads[0],payloads[1]);assert.equal(readOrderAttempt(7),null);
});

test('5xx and request ID conflicts preserve recovery data without automatic POST retry',async t=>{
  for(const [status,code] of [[500,'INTERNAL_ERROR'],[409,'ORDER_REQUEST_CONFLICT']]){
    const c=client();let calls=0;
    t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({detail:'실패',code},{status});});
    await hook(c).submit(form,cart);assert.equal(calls,1);assert.ok(readOrderAttempt(7));
    t.mock.restoreAll();
  }
});

test('amount conflict clears rejected attempt, refreshes cart and uses a new ID after reconfirmation',async t=>{
  const c=client();const ids=[];const updated={...cart,totalAmount:2000};
  t.mock.method(globalThis,'fetch',async(_url,init)=>{
    if(init.method==='POST'){
      const body=JSON.parse(init.body);ids.push(body.requestId);
      return ids.length===1?Response.json({detail:'금액 변경',code:'ORDER_AMOUNT_CHANGED'},{status:409}):Response.json(order);
    }return Response.json(updated);
  });
  const result=hook(c);await result.submit(form,cart);
  assert.equal(readOrderAttempt(7),null);assert.deepEqual(c.getQueryData(['cart',7]),updated);
  await result.submit(form,updated);assert.notEqual(ids[0],ids[1]);
});

test('401 clears authentication and private caches, but retains recoverable request',async t=>{
  const c=client();c.setQueryData(['orders',7,99],order);
  t.mock.method(globalThis,'fetch',async()=>Response.json({detail:'로그인 필요'},{status:401}));
  await hook(c).submit(form,cart);assert.equal(c.getQueryData(['me']),null);
  assert.equal(c.getQueryData(['cart',7]),undefined);assert.equal(c.getQueryData(['orders',7,99]),undefined);
  assert.ok(readOrderAttempt(7));
});

test('late success after account switch cannot update caches or return navigation target',async t=>{
  const c=client();const pending=deferred();const started=deferred();let calls=0;
  t.mock.method(globalThis,'fetch',()=>{calls++;started.resolve();return pending.promise;});
  const result=hook(c).submit(form,cart);await started.promise;c.setQueryData(['me'],{id:8});
  pending.resolve(Response.json(order));assert.equal(await result,null);assert.equal(calls,1);
  assert.equal(c.getQueryData(['orders',7,99]),undefined);assert.equal(c.getQueryData(['orders',8,99]),undefined);
  assert.ok(readOrderAttempt(7));assert.deepEqual(messages,[]);
});

test('order success remains success when cart refresh fails',async t=>{
  const c=client();t.mock.method(globalThis,'fetch',async(_url,init)=>init.method==='POST'?Response.json(order):Response.json({detail:'조회 실패'},{status:500}));
  assert.deepEqual(await hook(c).submit(form,cart),order);assert.deepEqual(c.getQueryData(['orders',7,99]),order);
  assert.equal(readOrderAttempt(7),null);assert.match(messages.at(-1),/주문은 생성/);
});

test('anonymous, empty cart and invalid delivery cannot submit',async t=>{
  const mock=t.mock.method(globalThis,'fetch',()=>{throw new Error('must not fetch');});
  await hook(client(null)).submit(form,cart);
  const c=client();await hook(c).submit(form,empty);await hook(c).submit({...form,postalCode:'x'},cart);
  assert.equal(mock.mock.callCount(),0);
});

test('same-tab storage recovers after module reload and isolates members',async t=>{
  const storage=new Map();const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete globalThis.window;});
  const request={...form,cartItemIds:[3],expectedTotalAmount:4200,requestId:crypto.randomUUID()};
  saveOrderAttempt(7,request);
  const reloaded=await import(moduleUrl('../src/features/create-order/model/order-attempt-store.ts',storeImports,'\n// reload'));
  assert.deepEqual(reloaded.readOrderAttempt(7),request);assert.equal(reloaded.readOrderAttempt(8),null);
  storage.set('order-attempt:9','broken JSON');assert.equal(reloaded.readOrderAttempt(9),null);
  saveOrderAttempt(7,null);
});

test('GET order accepts AbortSignal and uses the authenticated member query key',async t=>{
  const signal=new AbortController().signal;
  t.mock.method(globalThis,'fetch',async(url,init)=>{assert.equal(new URL(url).pathname,'/api/orders/99');assert.equal(init.signal,signal);return Response.json(order);});
  assert.deepEqual(await getOrder(99,signal),order);
  const c=client();let result;function Probe(){result=useOrder(null,99);return null;}
  renderToString(React.createElement(QueryClientProvider,{client:c},React.createElement(Probe)));
  assert.equal(result.fetchStatus,'idle');assert.ok(c.getQueryState(['orders',null,99]));
});

test('result UI renders saved item snapshots, delivery and order-created rather than paid status',async()=>{
  const {OrderDetails}=await import(moduleUrl('../src/entities/order/ui/order-details.tsx',{'react/jsx-runtime':import.meta.resolve('react/jsx-runtime')}));
  const html=renderToStaticMarkup(React.createElement(OrderDetails,{order:{...order,items:[{...order.items[0],productId:null}]}}));
  for(const pattern of [/주문 상세/,/주문 접수/,/결제 전/,/주문 당시 상품/,/수령인/,/4,200원/])assert.match(html,pattern);
});
