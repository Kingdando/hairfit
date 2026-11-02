const test = require('node:test');
const assert = require('node:assert/strict');
const { registerStylistRoutes } = require('../src/stylist-routes');

function setup(pool) {
  let handler;
  registerStylistRoutes({ get(path, auth, route) { if (path === '/api/stylist/dashboard') handler = route; } }, pool, () => {});
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { handler, res };
}
test('customers and owners cannot read hairstylist clients', async () => {
  for (const role of ['customer', 'owner']) {
    const { handler, res } = setup({ execute() { assert.fail('Must not query client data'); } });
    await handler({ user: { sub: 10, role } }, res, assert.fail);
    assert.equal(res.statusCode, 403);
  }
});
test('only bookings assigned to the authenticated staff profile are returned', async () => {
  let calls = 0;
  const { handler, res } = setup({ async execute(sql, params) {
    calls++;
    if (calls === 1) { assert.deepEqual(params, [10]); assert.match(sql, /st.user_id=\?/); assert.match(sql, /st.deleted_at IS NULL/); return [[{ id: 42, salonName: 'Salon' }]]; }
    if (calls === 2) { assert.match(sql, /WHERE b.stylist_id=\?/); assert.deepEqual(params, [42]); return [[{ id: 1, notes: 'FaceFit suggested hairstyle: Bob', context: JSON.stringify({ faceShape: 'oval' }) }]]; }
    if (calls === 5) { assert.deepEqual(params, [10]); assert.match(sql, /user_id=\?/); }
    else assert.deepEqual(params, [42]);
    return [[]];
  } });
  await handler({ user: { sub: 10, role: 'stylist' } }, res, assert.fail);
  assert.equal(res.body.data.bookings[0].notes, 'FaceFit suggested hairstyle: Bob');
  assert.equal(res.body.data.bookings[0].context.faceShape, 'oval');
  assert.equal(calls, 5);
});
test('removed staff profiles receive no bookings', async () => {
  let calls = 0;
  const { handler, res } = setup({ async execute() { calls++; return [[]]; } });
  await handler({ user: { sub: 10, role: 'stylist' } }, res, assert.fail);
  assert.equal(res.statusCode, 404); assert.equal(calls, 1);
});
