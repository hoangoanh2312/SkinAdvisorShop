// Offline checks for admin extension: no DB connection, no credentials, no mutations.
const assert = require('node:assert/strict');
const { csv } = require('../services/adminSupport');
const { parseRange } = require('../controllers/adminReportsController');
const InventoryMovement = require('../models/InventoryMovement');
const ReturnCase = require('../models/ReturnCase');
const { createApp } = require('../app');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

async function main() {
  assert.equal(parseRange({ from: '2026-11-01', to: '2026-11-02' }).end.toISOString(), '2026-11-03T00:00:00.000Z');
  assert.equal(parseRange({ from: '2026-02-30', to: '2026-03-10' }), null);
  assert.equal(parseRange({ from: '2026-12-31', to: '2026-01-01' }), null);
  assert.equal(parseRange({ from: '2020-01-01', to: '2026-01-01' }), null);
  const data = csv([{ field: '=HYPERLINK("evil")', newline: 'line1\r\nline2', neg: -5 }], [{ label: 'field', get: x=>x.field }, { label: 'note', get:x=>x.newline }, { label:'count',get:x=>x.neg }]);
  assert.ok(data.startsWith('\uFEFF'));
  assert.match(data, /'\=HYPERLINK/);
  assert.ok(!data.includes('line1\r\nline2'));
  const model = new InventoryMovement({ variant: '64f111111111111111111111', product:'64f111111111111111111111', kind:'sale', delta:-1, before:4, after:3, note:'Thanh toán COD' });
  await model.validate();
  const invalid = new InventoryMovement({ variant:'64f111111111111111111111', product:'64f111111111111111111111', kind:'receipt', delta:0.5, before:0, after:0.5, note:'incorrect' });
  await assert.rejects(invalid.validate());
  assert.ok(ReturnCase.schema.path('status').enumValues.includes('refund_confirmed'));
  const app = createApp();
  const server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',()=>resolve(s)); });
  try {
    for (const endpoint of ['/api/admin/inventory', '/api/admin/returns', '/api/admin/reports/summary', '/api/admin/readiness', '/api/admin/audit']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`);
      assert.equal(response.status, 401, endpoint + ' must require a login');
    }
    const existing = User.findById;
    const secret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'offline-test-secret-only-do-not-deploy-123456';
      User.findById = async () => ({ _id: '64f111111111111111111111', isActive: true, role: 'customer' });
      const token = jwt.sign({ id: '64f111111111111111111111' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/inventory`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(response.status, 403, 'customer role must never access inventory');
    } finally { User.findById = existing; if (secret == null) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = secret; }
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS offline: admin authentication/role, date validation, CSV formula safety, movement/return schemas');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
