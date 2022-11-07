// Switch these lines once there are useful utils
// const testUtils = require('./utils');
require('./utils');
const MemberAttributionService = require('../lib/service');

describe('MemberAttributionService', function () {
    describe('Constructor', function () {
        it('doesn\'t throw', function () {
            new MemberAttributionService({});
        });
    });

    describe('addEmailSourceAttributionTracking', function () {
        it('uses sluggified sitename for external urls', async function () {
            const service = new MemberAttributionService({
                getSiteTitle: () => 'Hello world'
            });
            const url = new URL('https://example.com/');
            const newsletterName = 'not used newsletter name';
            const newsletter = {
                get: (t) => {
                    if (t === 'name') {
                        return newsletterName;
                    }
                }
            };
            const isExternal = true;

            const updatedUrl = await service.addEmailSourceAttributionTracking(url, newsletter, isExternal);

            should(updatedUrl.toString()).equal('https://example.com/?ref=hello-world');
        });

        it('uses sluggified newsletter name for internal urls', async function () {
            const service = new MemberAttributionService({
                getSiteTitle: () => 'Hello world'
            });
            const url = new URL('https://example.com/');
            const newsletterName = 'used newsletter name';
            const newsletter = {
                get: (t) => {
                    if (t === 'name') {
                        return newsletterName;
                    }
                }
            };
            const isExternal = false;

            const updatedUrl = await service.addEmailSourceAttributionTracking(url, newsletter, isExternal);

            should(updatedUrl.toString()).equal('https://example.com/?ref=used-newsletter-name-newsletter');
        });

        it('does not repeat newsletter at the end of the newsletter name', async function () {
            const service = new MemberAttributionService({
                getSiteTitle: () => 'Hello world'
            });
            const url = new URL('https://example.com/');
            const newsletterName = 'Weekly newsletter';
            const newsletter = {
                get: (t) => {
                    if (t === 'name') {
                        return newsletterName;
                    }
                }
            };
            const isExternal = false;

            const updatedUrl = await service.addEmailSourceAttributionTracking(url, newsletter, isExternal);

            should(updatedUrl.toString()).equal('https://example.com/?ref=weekly-newsletter');
        });

        it('does not add ref to blacklisted domains', async function () {
            const service = new MemberAttributionService({
                getSiteTitle: () => 'Hello world'
            });
            const url = new URL('https://facebook.com/');
            const newsletterName = 'Weekly newsletter';
            const newsletter = {
                get: (t) => {
                    if (t === 'name') {
                        return newsletterName;
                    }
                }
            };
            const isExternal = true;

            const updatedUrl = await service.addEmailSourceAttributionTracking(url, newsletter, isExternal);

            should(updatedUrl.toString()).equal('https://facebook.com/');
        });
    });

    describe('getAttributionFromContext', function () {
        it('returns null if no context is provided', async function () {
            const service = new MemberAttributionService({
                getTrackingEnabled: () => true
            });
            const attribution = await service.getAttributionFromContext();

            should(attribution).be.null();
        });

        it('returns null if tracking is disabled is provided', async function () {
            const service = new MemberAttributionService({
                isTrackingEnabled: false
            });
            const attribution = await service.getAttributionFromContext();

            should(attribution).be.null();
        });

        it('returns attribution for importer context', async function () {
            const service = new MemberAttributionService({
                getTrackingEnabled: () => true
            });
            const attribution = await service.getAttributionFromContext({importer: true});

            should(attribution).containEql({referrerSource: 'Imported', referrerMedium: 'Member Importer'});
        });

        it('returns attribution for admin context', async function () {
            const service = new MemberAttributionService({
                getTrackingEnabled: () => true
            });
            const attribution = await service.getAttributionFromContext({user: 'abc'});

            should(attribution).containEql({referrerSource: 'Created manually', referrerMedium: 'Ghost Admin'});
        });

        it('returns attribution for api without integration context', async function () {
            const service = new MemberAttributionService({
                getTrackingEnabled: () => true
            });
            const attribution = await service.getAttributionFromContext({
                api_key: 'abc'
            });

            should(attribution).containEql({referrerSource: 'Created via API', referrerMedium: 'Admin API'});
        });

        it('returns attribution for api with integration context', async function () {
            const service = new MemberAttributionService({
                models: {
                    Integration: {
                        findOne: () => {
                            return {
                                get: () => 'Test Integration'
                            };
                        }
                    }
                },
                getTrackingEnabled: () => true
            });
            const attribution = await service.getAttributionFromContext({
                api_key: 'abc',
                integration: {id: 'integration_1'}
            });

            should(attribution).containEql({referrerSource: 'Integration: Test Integration', referrerMedium: 'Admin API'});
        });
    });

    describe('getEventAttribution', function () {
        it('returns null if attribution_type is null', function () {
            const service = new MemberAttributionService({
                attributionBuilder: {
                    build(attribution) {
                        return {
                            ...attribution,
                            getResource() {
                                return {
                                    ...attribution,
                                    title: 'added'
                                };
                            }
                        };
                    }
                },
                getTrackingEnabled: () => true
            });
            const model = {
                id: 'event_id',
                get() {
                    return null;
                }
            };
            should(service.getEventAttribution(model)).eql({
                id: null,
                url: null,
                title: 'added',
                type: null,
                referrerSource: null,
                referrerMedium: null,
                referrerUrl: null
            });
        });

        it('returns url attribution types', function () {
            const service = new MemberAttributionService({
                attributionBuilder: {
                    build(attribution) {
                        return {
                            ...attribution,
                            getResource() {
                                return {
                                    ...attribution,
                                    title: 'added'
                                };
                            }
                        };
                    }
                },
                getTrackingEnabled: () => true
            });
            const model = {
                id: 'event_id',
                get(name) {
                    if (name === 'attribution_type') {
                        return 'url';
                    }
                    if (name === 'attribution_url') {
                        return '/my/url/';
                    }
                    return null;
                }
            };
            should(service.getEventAttribution(model)).eql({
                id: null,
                type: 'url',
                url: '/my/url/',
                title: 'added',
                referrerMedium: null,
                referrerSource: null,
                referrerUrl: null
            });
        });

        it('returns first loaded relation', function () {
            const service = new MemberAttributionService({
                attributionBuilder: {
                    build(attribution) {
                        return {
                            ...attribution,
                            getResource() {
                                return {
                                    ...attribution,
                                    title: 'added'
                                };
                            }
                        };
                    }
                },
                getTrackingEnabled: () => true
            });
            const model = {
                id: 'event_id',
                get(name) {
                    if (name === 'attribution_type') {
                        return 'user';
                    }
                    if (name === 'attribution_url') {
                        return '/my/url/';
                    }
                    if (name.startsWith('referrer')) {
                        return null;
                    }
                    return 'test_user_id';
                },
                related(name) {
                    if (name === 'userAttribution') {
                        return {
                            id: 'test_user_id'
                        };
                    }
                    return {};
                }
            };
            should(service.getEventAttribution(model)).eql({
                id: 'test_user_id',
                type: 'user',
                url: '/my/url/',
                title: 'added',
                referrerMedium: null,
                referrerSource: null,
                referrerUrl: null
            });
        });
    });
});
