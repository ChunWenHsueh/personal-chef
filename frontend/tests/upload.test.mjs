import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadImage } from '../lib/api.ts';

function file() {
  return new File(['test-image-bytes'], 'ingredients.jpg', { type: 'image/jpeg' });
}

function presignResponse() {
  return Response.json({
    uploadUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/food.jpg?upload=test',
    accessUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/food.jpg?read=test',
    contentType: 'image/jpeg',
  });
}

test('retrying the same selected image reuses its object key', async (context) => {
  const filenames = [];
  let puts = 0;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method !== 'PUT') {
      filenames.push(new URL(url).searchParams.get('filename'));
      return presignResponse();
    }
    puts += 1;
    if (puts === 1) throw new TypeError('Failed to fetch');
    return new Response(null, { status: 200 });
  });
  const image = file();
  await assert.rejects(uploadImage(image, new AbortController().signal));
  assert.equal(await uploadImage(image, new AbortController().signal), 'https://test-bucket.s3.us-east-1.amazonaws.com/food.jpg?read=test');
  assert.equal(filenames.length, 2);
  assert.equal(filenames[0], filenames[1]);
  assert.equal(puts, 2);
});

test('unreachable S3 reports the upload stage and possible CORS issue', async (context) => {
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method !== 'PUT') return presignResponse();
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(uploadImage(file(), new AbortController().signal), /圖片上傳.*CORS/);
});

test('cancelling an upload preserves the abort error', async (context) => {
  const controller = new AbortController();
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method !== 'PUT') return presignResponse();
    controller.abort();
    throw controller.signal.reason;
  });
  await assert.rejects(uploadImage(file(), controller.signal), { name: 'AbortError' });
});
