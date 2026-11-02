import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
function moduleUrl(path, imports = {}) {
  let { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return dataUrl(outputText);
}
const { groupPermissions } = await import(moduleUrl('../src/views/profile/model/group-permissions.ts'));
test('permission grouping removes duplicate grants, sorts categories, and retains unknown grants', () => {
  const input = { permissions: ['P2','P1','P2','UNKNOWN'], permissionDetails: [
    { code:'P2',name:'두 번째',description:'',categoryCode:'B',categoryName:'배송',categorySortOrder:2 },
    { code:'P1',name:'첫 번째',description:'',categoryCode:'A',categoryName:'상품',categorySortOrder:1 },
    { code:'NOT_GRANTED',name:'권한 없음',description:'' },
  ] };
  const original = structuredClone(input);
  const result = groupPermissions(input);
  assert.deepEqual(result.permissions.map(p=>p.code),['P2','P1','UNKNOWN']);
  assert.deepEqual(result.permissionGroups.map(p=>p.code),['A','B','OTHER']);
  assert.equal(result.permissionGroups[2].permissions[0].name,'UNKNOWN');
  assert.deepEqual(input,original);
  assert.deepEqual(groupPermissions({permissions:[]}),{permissions:[],permissionGroups:[]});
});
const apiUrl = dataUrl('export let fail=false; export const setFail=value=>{fail=value}; export async function logout(){if(fail)throw new Error("logout failed")}');
const routerUrl = dataUrl('export const destinations=[]; export const useRouter=()=>({push:path=>destinations.push(path)});');
const api = await import(apiUrl);
const {destinations} = await import(routerUrl);
const {useLogout} = await import(moduleUrl('../src/features/logout/model/use-logout.ts',{
  '@tanstack/react-query':import.meta.resolve('@tanstack/react-query'),'next/navigation':routerUrl,'@/lib/api':apiUrl,
}));
function hook(client) {
  let result;
  function Probe(){result=useLogout();return null;}
  renderToString(React.createElement(QueryClientProvider,{client},React.createElement(Probe)));
  return result;
}
function client(){
  const c=new QueryClient({defaultOptions:{queries:{gcTime:Infinity},mutations:{gcTime:Infinity,retry:false}}});
  c.setQueryData(['me'],{id:1});
  for(const key of ['cart','orders','default-delivery','addresses'])c.setQueryData([key,1],{private:true});
  c.setQueryData(['products'],{public:true});return c;
}
test('successful logout clears private caches and navigates home while retaining public data',async()=>{
  api.setFail(false);destinations.length=0;const c=client();
  await hook(c).mutateAsync();
  assert.equal(c.getQueryData(['me']),null);
  for(const key of ['cart','orders','default-delivery','addresses'])assert.equal(c.getQueryData([key,1]),undefined);
  assert.deepEqual(c.getQueryData(['products']),{public:true});
  assert.deepEqual(destinations,['/']);
});
test('failed logout keeps the current session, private caches, and page',async()=>{
  api.setFail(true);destinations.length=0;const c=client();
  await assert.rejects(hook(c).mutateAsync(),/logout failed/);
  assert.deepEqual(c.getQueryData(['me']),{id:1});
  assert.deepEqual(c.getQueryData(['default-delivery',1]),{private:true});
  assert.deepEqual(destinations,[]);
});
