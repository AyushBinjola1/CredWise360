import {test} from 'node:test';
import assert from 'node:assert/strict';
test('web origin reaches a migrated native PostgreSQL service',async()=>{
  const response=await fetch((process.env.WEB_URL||'http://127.0.0.1:3000')+'/api/health');
  assert.equal(response.status,200);
  const {data}=await response.json();
  assert.equal(data.storage,'PostgreSQL');
  assert.ok(data.migrations>=1);
  assert.equal(data.initializations,1);
});
