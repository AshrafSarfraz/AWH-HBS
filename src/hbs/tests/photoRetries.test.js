const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const A = '000000000000000000000001', B = '000000000000000000000002';
const C = '000000000000000000000003';
function handler(photoOverrides = {}) {
  const stored = [];
  const Photo = {
    findOne: async q => stored.find(p => p.user === q.user && p.clientRequestId === q.clientRequestId),
    countDocuments: async () => stored.length,
    create: async p => {stored.push(p); return p;},
    ...photoOverrides,
  };
  const stubs = {
    '../../chat/services/profileAccess': {}, dotenv: {config() {}}, '../../models/venue': {},
    '../../models/brands': {findById: () => ({lean: async () => ({_id: B, status: 'active'})})},
    '../models/location': {findOne: async () => ({_id: C})}, '../models/photos': Photo,
    axios: {}, mongoose: {isValidObjectId: v => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v)},
  };
  const filename = path.resolve(__dirname, '../mapGallery/controller/location.js');
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console,
    require: n => {if (Object.hasOwn(stubs, n)) return stubs[n]; throw Error(`Unmocked ${n}`);},
  }, {filename});
  return {add: module.exports.addPhoto, stored};
}
async function call(add, body = {}, user = A) {
  const res = {statusCode: 200, status(n) {this.statusCode = n; return this;}, json(data) {this.data = data; return this;}};
  await add({user: user ? {id: user} : undefined, body: {brandId: B, image: 'https://example.test/a.jpg', caption: 'hello', clientRequestId: 'photo_a', ...body}}, res);
  return res;
}
test('retry after a lost response returns the same post, even at the brand limit', async () => {
  const {add, stored} = handler();
  assert.equal((await call(add)).statusCode, 201);
  assert.equal((await call(add, {clientRequestId: 'photo_b', image: 'https://example.test/b.jpg'})).statusCode, 201);
  assert.equal((await call(add)).statusCode, 200);
  assert.equal(stored.length, 2);
  assert.equal((await call(add, {clientRequestId: 'photo_c'})).statusCode, 400);
});
test('request IDs are scoped to author and cannot change post contents', async () => {
  const {add, stored} = handler();
  await call(add);
  assert.equal((await call(add, {image: 'https://example.test/different.jpg'})).statusCode, 409);
  assert.equal((await call(add, {caption: 'different'})).statusCode, 409);
  assert.equal((await call(add, {}, C)).statusCode, 201);
  assert.equal(stored.length, 2);
});
test('unauthorized and malformed requests cannot write photos', async () => {
  const {add, stored} = handler();
  assert.equal((await call(add, {}, null)).statusCode, 401);
  for (const body of [{clientRequestId: ''}, {clientRequestId: {}}, {caption: {}}, {brandId: 'bad'}, {image: ''}]) {
    assert.equal((await call(add, body)).statusCode, 400);
  }
  assert.equal(stored.length, 0);
});
test('older clients without request IDs still save successfully', async () => {
  const {add, stored} = handler();
  assert.equal((await call(add, {clientRequestId: undefined})).statusCode, 201);
  assert.equal(stored[0].clientRequestId, undefined);
});
test('a concurrent unique-index collision replays the successful write', async () => {
  const existing = {user: A, brand: B, image: 'https://example.test/a.jpg', caption: 'hello', clientRequestId: 'photo_a'};
  let reads = 0;
  const {add} = handler({
    findOne: async () => ++reads === 1 ? null : existing,
    create: async () => {throw Object.assign(new Error('duplicate'), {code: 11000});},
  });
  const result = await call(add);
  assert.equal(result.statusCode, 200);
  assert.equal(result.data.data, existing);
});
