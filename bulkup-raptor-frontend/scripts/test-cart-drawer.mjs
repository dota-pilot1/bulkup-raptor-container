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
const react = import.meta.resolve('react');
const drawer = dataUrl(`import React from "${react}"; export function Drawer({title,description,children,footer}) {return React.createElement('section',null,title,description,children,footer);}`);
const visual = dataUrl(`import React from "${react}"; export function ProductVisual({product}) {return React.createElement('img',{alt:product.name,src:product.imageUrl??''})}`);
const quantityStateUrl = dataUrl('export const quantityState = {isPending:false, update(){}}; export const useUpdateCartItemQuantity=()=>quantityState;');
const { quantityState } = await import(quantityStateUrl);
const deletionStateUrl = dataUrl('export const deletionState = {isPending:false, remove(){}}; export const useDeleteCartItem=()=>deletionState;');
const { deletionState } = await import(deletionStateUrl);
const { CartDrawer } = await import(moduleUrl('../src/widgets/header/ui/cart-drawer.tsx', {
  'next/navigation': dataUrl('export const useRouter=()=>({push(){}});'),
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  '@/features/update-cart-item-quantity/model/use-update-cart-item-quantity': quantityStateUrl,
  '@/features/delete-cart-item/model/use-delete-cart-item': deletionStateUrl,
  '@/components/ui/drawer': drawer,
  '@/entities/product/ui/product-visual': visual,
}));
const member = {data:{id:1},isPending:false,isError:false,refetch(){}};
const cart = data => ({data,isPending:false,isFetching:false,isError:false,refetch(){}});
const draw = (memberState,cartState) => renderToStaticMarkup(React.createElement(CartDrawer, {
  isOpen:true,onClose(){},onLogin(){},member:memberState,cart:cartState,
}));
const serverCart = {
  items: [{id:9,product:{id:2,name:'상품 A',price:500,categoryLabel:'보충제',stockQuantity:100,reservedQuantity:90,availableQuantity:10,imageUrl:'https://example.test/a.png'},quantity:2,lineTotal:1700}],
  totalQuantity: 2, totalAmount: 1700,
};

test('anonymous viewer sees login prompt rather than an empty cart', () => {
  const html = draw({...member,data:null},cart(undefined));
  assert.match(html,/로그인이 필요합니다/);
  assert.doesNotMatch(html,/장바구니가 비어 있습니다/);
});

test('loading and failure hide stale contents and offer retry on failure', () => {
  const loading = draw(member,{...cart(serverCart),isFetching:true});
  assert.match(loading,/장바구니를 불러오는 중입니다/);
  assert.doesNotMatch(loading,/상품 A/);
  const failed = draw(member,{...cart(serverCart),isError:true});
  assert.match(failed,/장바구니를 불러오지 못했습니다/);
  assert.match(failed,/다시 시도/);
  assert.doesNotMatch(failed,/상품 A|장바구니가 비어 있습니다/);
});

test('authenticated empty response shows empty state', () => {
  const html = draw(member,cart({items:[],totalQuantity:0,totalAmount:0}));
  assert.match(html,/장바구니가 비어 있습니다/);
  assert.doesNotMatch(html,/주문하기/);
});

test('rows and totals use the server cart and quantity controls are enabled', () => {
  const html = draw(member,cart(serverCart));
  assert.match(html,/상품 A/);
  assert.match(html,/1종의 상품이 담겨 있습니다/);
  assert.doesNotMatch(html,/2종의 상품이 담겨 있습니다/);
  assert.match(html,/1,700원/);
  assert.doesNotMatch(html,/1,000원/);
  assert.match(html,/src="https:\/\/example.test\/a.png"/);
  assert.match(html,/주문하기/);
  assert.match(html,/aria-label="상품 A 삭제"/);
  assert.doesNotMatch(html,/disabled=""[^>]*aria-label="상품 A 삭제"/);
  assert.match(html,/aria-label="상품 A 수량 증가"/);
  assert.doesNotMatch(html,/disabled=""[^>]*aria-label="상품 A 수량 증가"/);
});

test('member lookup failure does not show a login or empty-cart state', () => {
  const html = draw({...member,data:undefined,isError:true},cart(undefined));
  assert.match(html,/다시 시도/);
  assert.doesNotMatch(html,/로그인이 필요합니다|장바구니가 비어 있습니다/);
});


test('quantity boundaries and pending state disable the appropriate controls', () => {
  const at = quantity => ({...serverCart, items: [{...serverCart.items[0], quantity}]});
  assert.match(draw(member,cart(at(1))), /disabled=""[^>]*aria-label="상품 A 수량 감소"/);
  assert.match(draw(member,cart(at(99))), /disabled=""[^>]*aria-label="상품 A 수량 증가"/);
  quantityState.isPending = true;
  try {
    const html = draw(member,cart(serverCart));
    assert.match(html, /장바구니 변경을 처리하는 중입니다/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /disabled=""[^>]*aria-label="상품 A 수량 감소"/);
    assert.match(html, /disabled=""[^>]*aria-label="상품 A 수량 증가"/);
  } finally { quantityState.isPending = false; }
});

test('deletion locks delete and quantity controls until refresh finishes', () => {
  deletionState.isPending = true;
  try {
    const html = draw(member,cart(serverCart));
    for (const label of ['삭제', '수량 감소', '수량 증가']) {
      assert.match(html, new RegExp(`disabled=""[^>]*aria-label="상품 A ${label}"`));
    }
    assert.match(html, /aria-busy="true"/);
  } finally { deletionState.isPending = false; }
});


test('cart displays available rather than physical stock and stops increases at that quantity',()=>{
  const html=draw(member,cart(serverCart)).replaceAll('<!-- -->','');
  assert.match(html,/현재 구매 가능 10개/);
  assert.ok(!html.includes('현재 구매 가능 100개'));
  const atLimit={...serverCart,items:[{...serverCart.items[0],quantity:10}]};
  assert.match(draw(member,cart(atLimit)),/disabled=""[^>]*aria-label="상품 A 수량 증가"/);
  const overLimit={...serverCart,items:[{...serverCart.items[0],quantity:11}]};
  assert.match(draw(member,cart(overLimit)),/담은 수량이 구매 가능 수량을 초과/);
});

test('a sold-out cart item remains visible and removable while increases are blocked',()=>{
  const unavailable={...serverCart,items:[{...serverCart.items[0],product:{...serverCart.items[0].product,reservedQuantity:100,availableQuantity:0}}]};
  const html=draw(member,cart(unavailable)).replaceAll('<!-- -->','');
  assert.match(html,/품절 · 현재 구매 가능 0개/);
  assert.match(html,/disabled=""[^>]*aria-label="상품 A 수량 증가"/);
  assert.doesNotMatch(html,/disabled=""[^>]*aria-label="상품 A 삭제"/);
  assert.doesNotMatch(html,/disabled=""[^>]*aria-label="상품 A 수량 감소"/);
});
