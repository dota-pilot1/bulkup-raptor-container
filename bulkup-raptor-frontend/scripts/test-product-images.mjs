import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function moduleUrl(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  for (const [name, url] of Object.entries(imports)) outputText = outputText.replaceAll(`"${name}"`, `"${url}"`);
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}

const clientUrl = moduleUrl('../src/shared/api/client.ts');
const imports = { '@/shared/api/client': clientUrl };
const { updateProductWithImage } = await import(moduleUrl('../src/features/product-registration/api/update-product-with-image.ts', imports));
const { registerProduct } = await import(moduleUrl('../src/features/product-registration/api/register-product.ts', imports));
const input = { name: '수정 상품', description: '설명', price: 28000, category: 'SUPPLEMENT', badge: '', visual: '📦' };

async function readRequest(url, init) {
  assert.equal(init.credentials, 'include');
  // 클라이언트가 경계값 없이 Content-Type을 강제로 지정하면 파일을 파싱할 수 없다.
  assert.equal(new Headers(init.headers).has('Content-Type'), false);
  const request = new Request(url, init);
  assert.match(request.headers.get('Content-Type'), /^multipart\/form-data; boundary=.+/);
  const body = await request.formData();
  assert.equal(body.get('product').type, 'application/json');
  assert.deepEqual(JSON.parse(await body.get('product').text()), input);
  return body;
}

test('image update sends authenticated PUT with JSON and the selected file; returns Product directly', async (t) => {
  const file = new File([new Uint8Array([137, 80, 78, 71])], 'replacement.png', { type: 'image/png' });
  const product = { ...input, id: 5, imageUrl: 'https://images.example.test/new.png' };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/products/5');
    assert.equal(init.method, 'PUT');
    const body = await readRequest(url, init);
    const uploaded = body.get('file');
    assert.equal(uploaded.name, file.name);
    assert.equal(uploaded.type, file.type);
    assert.deepEqual(await uploaded.arrayBuffer(), await file.arrayBuffer());
    return Response.json(product);
  });
  assert.deepEqual(await updateProductWithImage(5, input, file), product);
});

test('no replacement omits file part so the server can keep the existing image', async (t) => {
  const product = { ...input, id: 5, imageUrl: 'https://images.example.test/existing.png' };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(init.method, 'PUT');
    const body = await readRequest(url, init);
    assert.equal(body.has('file'), false);
    return Response.json(product);
  });
  assert.equal((await updateProductWithImage(5, input, null)).imageUrl, product.imageUrl);
});

test('server upload error rejects the update rather than returning a success-shaped result', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(
    { code: 'IMAGE_STORAGE_FAILED', detail: '이미지 저장에 실패했습니다.' }, { status: 502 },
  ));
  await assert.rejects(updateProductWithImage(5, input, null), /이미지 저장에 실패했습니다/);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('product registration keeps its POST and wrapped response contract', async (t) => {
  const response = { product: { ...input, id: 6, imageUrl: null }, imageUploadError: null };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/products');
    assert.equal(init.method, 'POST');
    const body = await readRequest(url, init);
    assert.equal(body.has('file'), false);
    return Response.json(response, { status: 201 });
  });
  assert.deepEqual(await registerProduct(input, null), response);
});
