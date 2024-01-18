const assert = require('assert/strict');
const sinon = require('sinon');
const logging = require('@tryghost/logging');
const RedisCache = require('../index');

describe('Adapter Cache Redis', function () {
    beforeEach(function () {
        sinon.stub(logging, 'error');
    });

    afterEach(function () {
        sinon.restore();
    });

    it('can initialize Redis cache instance directly', async function () {
        const redisCacheInstanceStub = {
            store: {
                getClient: sinon.stub().returns({
                    on: sinon.stub()
                })
            }
        };
        const cache = new RedisCache({
            cache: redisCacheInstanceStub
        });

        assert.ok(cache);
    });

    it('can initialize with storeConfig', async function () {
        const cache = new RedisCache({
            username: 'myusername',
            storeConfig: {
                retryStrategy: false,
                lazyConnect: true
            },
            reuseConnection: false
        });
        assert.ok(cache);
        assert.equal(cache.redisClient.options.username, 'myusername');
        assert.equal(cache.redisClient.options.retryStrategy, false);
    });

    describe('get', function () {
        it('can get a value from the cache', async function () {
            const redisCacheInstanceStub = {
                get: sinon.stub().resolves('value from cache'),
                store: {
                    getClient: sinon.stub().returns({
                        on: sinon.stub()
                    })
                }
            };
            const cache = new RedisCache({
                cache: redisCacheInstanceStub
            });

            const value = await cache.get('key');

            assert.equal(value, 'value from cache');
        });
        it('can update the cache in the case of a cache miss', async function () {
            const KEY = 'update-cache-on-miss';
            let cachedValue = null;
            const redisCacheInstanceStub = {
                get: function (key) {
                    if (key === 'prefix_hash') {
                        return 'prefix_hash';
                    }
                    if (key === 'prefix_hash' + KEY) {
                        return cachedValue;
                    }
                },
                set: function (key, value) {
                    if (key === 'prefix_hash' + KEY) {
                        cachedValue = value;
                    }
                },
                store: {
                    getClient: sinon.stub().returns({
                        on: sinon.stub()
                    })
                }
            };
            const cache = new RedisCache({
                cache: redisCacheInstanceStub
            });

            const fetchData = sinon.stub().resolves('Da Value');

            checkFirstRead: {
                const value = await cache.get(KEY, fetchData);
                assert.equal(fetchData.callCount, 1);
                assert.equal(value, 'Da Value');
                break checkFirstRead;
            }

            checkSecondRead: {
                const value = await cache.get(KEY, fetchData);
                assert.equal(fetchData.callCount, 1);
                assert.equal(value, 'Da Value');
                break checkSecondRead;
            }
        });

        it('Can do a background update of the cache', async function () {
            const KEY = 'update-cache-in-background';
            let cachedValue = null;
            let remainingTTL = 100;

            const redisCacheInstanceStub = {
                get: function (key) {
                    if (key === 'prefix_hash') {
                        return 'prefix_hash';
                    }
                    if (key === 'prefix_hash' + KEY) {
                        return cachedValue;
                    }
                },
                set: function (key, value) {
                    if (key === 'prefix_hash' + KEY) {
                        cachedValue = value;
                    }
                },
                ttl: function (key) {
                    if (key === 'prefix_hash' + KEY) {
                        return remainingTTL;
                    }
                },
                store: {
                    getClient: sinon.stub().returns({
                        on: sinon.stub()
                    })
                }
            };
            const cache = new RedisCache({
                cache: redisCacheInstanceStub,
                ttl: 100,
                refreshAheadFactor: 0.2
            });

            const fetchData = sinon.stub();
            fetchData.onFirstCall().resolves('First Value');
            fetchData.onSecondCall().resolves('Second Value');

            checkFirstRead: {
                const value = await cache.get(KEY, fetchData);
                assert.equal(fetchData.callCount, 1);
                assert.equal(value, 'First Value');
                break checkFirstRead;
            }

            // We simulate having been in the cache for 15 seconds
            remainingTTL = 85;

            checkSecondRead: {
                const value = await cache.get(KEY, fetchData);
                assert.equal(fetchData.callCount, 1);
                assert.equal(value, 'First Value');
                break checkSecondRead;
            }

            // We simulate having been in the cache for 30 seconds
            remainingTTL = 70;

            checkThirdRead: {
                const value = await cache.get(KEY, fetchData);
                assert.equal(fetchData.callCount, 1);
                assert.equal(value, 'First Value');
                break checkThirdRead;
            }

            // We simulate having been in the cache for 85 seconds
            // This should trigger a background refresh
            remainingTTL = 15;

            checkFourthRead: {
                const value = await cache.get(KEY, fetchData);
                assert.equal(fetchData.callCount, 2);
                assert.equal(value, 'First Value');
                break checkFourthRead;
            }

            // We reset the TTL to 100 for the most recent write
            remainingTTL = 100;

            checkFifthRead: {
                const value = await cache.get(KEY, fetchData);
                assert.equal(fetchData.callCount, 2);
                assert.equal(value, 'Second Value');
                break checkFifthRead;
            }
        });
    });

    describe('set', function () {
        it('can set a value in the cache', async function () {
            const redisCacheInstanceStub = {
                get: function (key) {
                    if (key === 'prefix_hash') {
                        return 'prefix_hash';
                    }
                },
                set: sinon.stub().resolvesArg(1),
                store: {
                    getClient: sinon.stub().returns({
                        on: sinon.stub()
                    })
                }
            };
            const cache = new RedisCache({
                cache: redisCacheInstanceStub
            });

            const value = await cache.set('key-here', 'new value');

            assert.equal(value, 'new value');
            assert.equal(redisCacheInstanceStub.set.args[0][0], 'prefix_hashkey-here');
        });

        it('sets a key based on keyPrefix', async function () {
            const redisCacheInstanceStub = {
                get: function (key) {
                    if (key === 'testing-prefix:prefix_hash') {
                        return 'prefix_hash';
                    }
                },
                set: sinon.stub().resolvesArg(1),
                store: {
                    getClient: sinon.stub().returns({
                        on: sinon.stub()
                    })
                }
            };
            const cache = new RedisCache({
                cache: redisCacheInstanceStub,
                keyPrefix: 'testing-prefix:'
            });

            const value = await cache.set('key-here', 'new value');

            assert.equal(value, 'new value');
            assert.equal(redisCacheInstanceStub.set.args[0][0], 'testing-prefix:prefix_hashkey-here');
        });
    });

    describe('reset', function () {
        it('Updates the prefix_hash cache input with 0 ttl', async function () {
            const redisCacheInstanceStub = {
                get: sinon.stub().resolves('value from cache'),
                set: sinon.stub().resolvesArg(1),
                store: {
                    getClient: sinon.stub().returns({
                        on: sinon.stub()
                    })
                }
            };
            const cache = new RedisCache({
                cache: redisCacheInstanceStub
            });

            await cache.reset();

            assert.equal(redisCacheInstanceStub.set.args[0][0], 'prefix_hash');
            assert.deepEqual(redisCacheInstanceStub.set.args[0][2], {ttl: 0});
        });
    });
});
