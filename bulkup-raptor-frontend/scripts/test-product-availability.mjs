import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const dataUrl=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path,imports={}){
  let {outputText}=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  });
  for(const [name,url] of Object.entries(imports))outputText=outputText.replaceAll(`"${name}"`,`"${url}"`);
  return dataUrl(outputText);
}
const addUrl=dataUrl('export let calls=0;export const reset=()=>calls=0;export const useAddCartItem=()=>({add:async()=>{calls++;},isPending:false});');
const dialogUrl=dataUrl('export let props;export const Dialog=value=>{props=value;return null;};');
const add=await import(addUrl),dialog=await import(dialogUrl);
const {ProductCard}=await import(moduleUrl('../src/entities/product/ui/product-card.tsx',{
  react:import.meta.resolve('react'),'react/jsx-runtime':import.meta.resolve('react/jsx-runtime'),
  '@/features/add-to-cart/model/use-add-cart-item':addUrl,
  '@/shared/ui/dialog':dialogUrl,
  './product-visual':dataUrl('export const ProductVisual=()=>null;'),
  '../model/product':moduleUrl('../src/entities/product/model/product.ts'),
}));
const product={id:7,name:'테스트 상품',description:'설명',price:1000,category:'SNACK',categoryLabel:'간식',badge:'BEST',visual:'X',stockQuantity:10,reservedQuantity:0,availableQuantity:10};
function findAddButton(node) {
  if (!React.isValidElement(node)) return undefined;
  if (node.type === 'button' && node.props.children === '담기') return node;
  return React.Children.toArray(node.props.children).map(findAddButton).find(Boolean);
}
const render=value=>renderToStaticMarkup(React.createElement(ProductCard,{product:value}));
test('zero physical stock and fully reserved stock both show sold out and prevent adding',()=>{
  for(const value of [{...product,stockQuantity:0,availableQuantity:0},{...product,reservedQuantity:10,availableQuantity:0}]){
    add.reset();const html=render(value);
    assert.match(html,/품절/);assert.match(html,/role="status"/);
    assert.ok(!html.includes('장바구니에 담기'));assert.ok(!html.includes('BEST'));
    assert.equal(dialog.props.isOpen,false);
    findAddButton(dialog.props.children).props.onClick();assert.equal(add.calls,0);
  }
});
test('one available unit keeps the add action and normal product badge',()=>{
  add.reset();const html=render({...product,reservedQuantity:9,availableQuantity:1});
  assert.ok(!html.includes('품절'));assert.match(html,/테스트 상품 장바구니에 담기/);assert.match(html,/BEST/);
  const details=renderToStaticMarkup(React.createElement(React.Fragment,null,dialog.props.children)).replaceAll('<!-- -->','');
  assert.match(details,/현재 구매 가능 1개/);
  assert.ok(!details.includes('현재 구매 가능 10개'));
  assert.match(details,/장바구니에 담아도 재고는 확보되지 않습니다/);
  findAddButton(dialog.props.children).props.onClick();assert.equal(add.calls,1);
});
