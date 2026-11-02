import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText);
}
const apiUrl = moduleUrl('../src/shared/api/client.ts');
const { ApiError } = await import(apiUrl);
const stateUrl = dataUrl('export const state = {member: null, cart: {data:undefined,isError:false,isFetching:false,refetch() {}}};');
const { state } = await import(stateUrl);
const reactUrl = import.meta.resolve('react');
const queryUrl = dataUrl(`import {state} from "${stateUrl}";
  export const useQuery=()=>({data:state.member});
  export const useMutation=()=>({mutate(){},isPending:false});
  export const useQueryClient=()=>({getQueryData(){return state.member},setQueryData(){},removeQueries(){},invalidateQueries(){}});`);
const cartUrl = dataUrl(`import {state} from "${stateUrl}";
  export const useCart = memberId => memberId === null ? {data:undefined,isError:false,isFetching:false,refetch(){}} : state.cart;`);
const emptyComponent = dataUrl('export const LoginDialog=()=>null; export const SearchDialog=()=>null; export const CartDrawer=()=>null;');
const imports = {
  react: reactUrl,
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  'next/link': dataUrl(`import React from "${reactUrl}"; export default function Link({children,...props}) {return React.createElement('a',props,children);}`),
  'next/navigation': dataUrl('export const usePathname=()=>"/"; export const useSearchParams=()=>new URLSearchParams();'),
  '@tanstack/react-query': queryUrl,
  '@/entities/product/model/product': dataUrl('export const catalogNav=[]; export const categoryFromQuery=()=>"ALL"; export const categoryHref=()=>"/";'),
  '@/lib/api': dataUrl('export const currentMember=()=>null; export const logout=()=>null;'),
  '@/entities/session': dataUrl('export const canAccessAdmin=()=>false; export const MemberAvatar=()=>null;'),
  '@/entities/cart/model/use-cart': cartUrl,
  '@/shared/api/client': apiUrl,
  '@/features/login': emptyComponent,
  './search-dialog': emptyComponent,
  './cart-drawer': emptyComponent,
};
const { Header } = await import(moduleUrl('../src/widgets/header/ui/header.tsx', imports));
const member = {id: 7, name: '회원', email: 'test@example.test'};
const draw = () => renderToStaticMarkup(React.createElement(Header));
const cart = (data, extra={}) => ({data,isError:false,isFetching:false,refetch(){},...extra});

test('header displays item count rather than total quantity, including accessible count', () => {
  state.member = member;
  state.cart = cart({items: [{id:1, quantity:2}, {id:2, quantity:1}], totalQuantity: 3, totalAmount: 0});
  const html = draw();
  assert.match(html, /aria-label="장바구니 열기, 상품 2종"/);
  assert.match(html, />2<\/span>/);
});

test('empty cart and anonymous user have no count badge', () => {
  state.member = member;
  state.cart = cart({items: [], totalQuantity: 0, totalAmount: 0});
  assert.doesNotMatch(draw(), /장바구니 열기, 상품/);
  state.member = null;
  state.cart = cart({items: [{id:1, quantity:3}], totalQuantity: 3, totalAmount: 0});
  const html = draw();
  assert.match(html, /aria-label="장바구니 열기"/);
  assert.doesNotMatch(html, /장바구니 열기, 상품/);
});

test('failed lookup displays retry instead of stale or empty count', () => {
  state.member = member;
  state.cart = cart({items: [{id:1, quantity:3}], totalQuantity: 3, totalAmount: 0}, {isError:true,error:new ApiError('서버 오류',503)});
  const html = draw();
  assert.match(html, /장바구니 수량 조회 실패. 다시 시도/);
  assert.doesNotMatch(html, /장바구니 열기, 상품 1종/);
});

test('401 does not offer retry for a session that needs authentication', () => {
  state.member = member;
  state.cart = cart(undefined, {isError:true,error:new ApiError('로그인이 필요합니다.',401)});
  assert.doesNotMatch(draw(), /장바구니 수량 조회 실패. 다시 시도/);
});
