import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplyPlan, buildStalwartArtifacts } from '../../scripts/stalwart/config.mjs';

const env = {
  STALWART_HOSTNAME: 'mail.ifkafin.com',
  STALWART_DEFAULT_DOMAIN: 'heylomeet.com',
  STALWART_HTTP_CORS_ALLOWED_ORIGINS: 'https://webmail.ifkafin.com',
  STALWART_S3_ACCESS_KEY: 'test-public-access-key',
};
test('post-setup plan preserves stores, domains, listeners and DKIM', () => {
  const plan = buildApplyPlan(env);
  assert.deepEqual(plan.map(x => x.object), ['Http', 'SystemSettings', 'MtaStageConnect']);
  assert.ok(plan.every(x => x['@type'] === 'update'));
  assert.equal(plan.find(x => x.object === 'SystemSettings').value.defaultHostname, 'mail.ifkafin.com');
});
test('CORS allows the webmail origin and browser authorization preflight', () => {
  const http = buildApplyPlan(env)[0].value;
  assert.equal(http.usePermissiveCors, false);
  assert.equal(http.responseHeaders['Access-Control-Allow-Origin'], 'https://webmail.ifkafin.com');
  assert.match(http.responseHeaders['Access-Control-Allow-Headers'], /Authorization/);
  assert.match(http.responseHeaders['Access-Control-Allow-Methods'], /OPTIONS/);
  assert.equal(http.clientIpSource, 'peer');
  assert.equal(buildApplyPlan({...env, STALWART_HTTP_USE_X_FORWARDED: 'true'})[0].value.clientIpSource, 'xForwardedFor');
  assert.ok(!('useXForwarded' in http));
});
test('rejects invalid static CORS lists and container hostnames', () => {
  assert.throws(() => buildApplyPlan({...env, STALWART_HTTP_CORS_ALLOWED_ORIGINS: 'https://a.test,https://b.test'}));
  assert.throws(() => buildApplyPlan({...env, STALWART_HOSTNAME: 'ecf6056877f9'}));
});
test('bootstrap points at Garage with a file secret and separate mail domain', () => {
  const { bootstrap } = buildStalwartArtifacts(env);
  assert.equal(bootstrap.blobStore['@type'], 'S3');
  assert.equal(bootstrap.blobStore.region['@type'], 'Custom');
  assert.equal(bootstrap.inMemoryStore.url, 'redis://:stalwart@stalwart-redis:6379/0');
  assert.equal(bootstrap.defaultHostname, 'mail.ifkafin.com');
  assert.equal(bootstrap.defaultDomain, 'heylomeet.com');
  assert.equal(bootstrap.blobStore.region.url, 'http://stalwart-garage:3900');
  assert.equal(bootstrap.blobStore.accessKeyId.value, env.STALWART_S3_ACCESS_KEY);
  assert.deepEqual(bootstrap.blobStore.secretKey, {'@type':'File', filePath:'/etc/stalwart-s3/secret-key'});
});
