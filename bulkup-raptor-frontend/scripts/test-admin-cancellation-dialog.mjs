import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import {renderToString,renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
const dataUrl=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
function moduleUrl(path,imports={}){
 let {outputText}=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 for(const [from,to]of Object.entries(imports))outputText=outputText.replaceAll(`"${from}"`,`"${to}"`);
 return dataUrl(outputText);
}
const common={react:import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),'@tanstack/react-query':import.meta.resolve('@tanstack/react-query')};
const clientUrl=moduleUrl('../src/shared/api/client.ts');
const sessionUrl=moduleUrl('../src/entities/session/model/admin-access.ts');
const meUrl=dataUrl('export const currentMember=async()=>null');
const {AdminCancellationDialog,CancellationSummary}=await import(moduleUrl('../src/components/admin/admin-cancellation-dialog.tsx',{
 ...common,'@/lib/api':meUrl,'@/entities/session':sessionUrl,
 '@/entities/order/api/get-admin-orders':moduleUrl('../src/entities/order/api/get-admin-orders.ts',{'@/shared/api/client':clientUrl}),
 '@/shared/ui/dialog':moduleUrl('../src/shared/ui/dialog.tsx',common),
}));
const member={id:7,permissions:['MENU_ADMIN_ACCESS'],roles:[{code:'MEMBER'}]};
const detail={buyer:{memberId:12,name:'주문자',email:'buyer@example.test'},order:{orderId:51,status:'CANCELLED',cancellationReason:'중복 주문\n수량 변경',createdAt:'2026-01-01T00:00:00Z'},payment:{status:'CANCELLED'}};
function render({viewer=member,error=false,...options}={}){
 const data = 'data' in options ? options.data : detail;
 const client=new QueryClient({defaultOptions:{queries:{gcTime:Infinity,staleTime:Infinity,retry:false}}});
 client.setQueryData(['me'],viewer);
 if(data)client.setQueryData(['admin-order',7,51],data);
 if(error)client.getQueryCache().find({queryKey:['admin-order',7,51]}).setState({status:'error',fetchStatus:'idle',error:new Error('failed')});
 return {client,html:renderToString(React.createElement(QueryClientProvider,{client},React.createElement(AdminCancellationDialog,{memberId:7,orderId:51,onClose(){}})))};
}
test('dialog shows the stored cancellation reason and payment result',()=>{
 const {html}=render();
 for(const text of ['role="dialog"','주문 #51 취소 상세','주문 취소됨','중복 주문','결제 취소 완료','닫기'])assert.ok(html.includes(text),text);
 assert.ok(!html.includes('처리 이력'));
 assert.ok(!html.includes('취소 요청자'));
});
test('missing reason is omitted',()=>{
 const data={...detail,order:{...detail.order,cancellationReason:'  '}};
 const html=render({data}).html;
 assert.ok(!html.includes('취소 사유'));
 assert.ok(!html.includes('입력하지 않음'));
});
test('payment result never assumes a refund for unpaid, missing or still-paid payment records',()=>{
 for(const [payment,label]of [[null,'결제 내역 없음'],[{status:'READY'},'결제 전 주문'],[{status:'PAID'},'결제 취소 확인 필요']]){
  const html=renderToStaticMarkup(React.createElement(CancellationSummary,{detail:{...detail,payment}}));
  assert.ok(html.includes(label));assert.ok(!html.includes('결제 취소 완료'));
 }
});
test('different account and missing admin permission cannot see cached cancellation details',()=>{
 for(const viewer of [{...member,id:8},{...member,permissions:[]}])assert.equal(render({viewer}).html,'');
});
test('loading and failed detail do not reveal a stale cached order',()=>{
 const loading=render({data:undefined}).html;assert.match(loading,/불러오는 중/);assert.ok(!loading.includes('중복 주문'));
 const failed=render({error:true}).html;assert.match(failed,/불러오지 못했습니다/);assert.ok(!failed.includes('중복 주문'));
});
