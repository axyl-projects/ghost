const should = require('should');
const sinon = require('sinon');
const assert = require('assert');

// Stuff we are testing
const DomainEvents = require('@tryghost/domain-events');
const {URLResourceUpdatedEvent} = require('@tryghost/dynamic-routing-events');

const events = require('../../../../../core/server/lib/common/events');

const SiteMapManager = require('../../../../../core/frontend/services/sitemap/manager');
const PostGenerator = require('../../../../../core/frontend/services/sitemap/post-generator');
const PageGenerator = require('../../../../../core/frontend/services/sitemap/page-generator');
const TagGenerator = require('../../../../../core/frontend/services/sitemap/tag-generator');
const UserGenerator = require('../../../../../core/frontend/services/sitemap/user-generator');
const IndexGenerator = require('../../../../../core/frontend/services/sitemap/index-generator');

describe('Unit: sitemap/manager', function () {
    let eventsToRemember;

    const makeStubManager = function () {
        let posts;
        let pages;
        let tags;
        let authors;
        let index;

        index = new IndexGenerator();
        posts = new PostGenerator();
        pages = new PageGenerator();
        tags = new TagGenerator();
        authors = new UserGenerator();

        return new SiteMapManager({posts: posts, pages: pages, tags: tags, authors: authors});
    };

    before(function () {
        eventsToRemember = {};

        // @NOTE: the pattern of faking event call is not great, we should be
        //        ideally tasting on real events instead of faking them
        sinon.stub(events, 'on').callsFake(function (eventName, callback) {
            eventsToRemember[eventName] = callback;
        });

        sinon.stub(PostGenerator.prototype, 'getXml');
        sinon.stub(PostGenerator.prototype, 'addUrl');
        sinon.stub(PostGenerator.prototype, 'removeUrl');
        sinon.stub(IndexGenerator.prototype, 'getXml');
    });

    after(function () {
        sinon.restore();
    });

    describe('SiteMapManager', function () {
        let manager;

        before(function () {
            manager = makeStubManager();
        });

        it('can create a SiteMapManager instance', function () {
            should.exist(manager);
            Object.keys(eventsToRemember).length.should.eql(4);
            should.exist(eventsToRemember['url.added']);
            should.exist(eventsToRemember['url.removed']);
            should.exist(eventsToRemember['router.created']);
            should.exist(eventsToRemember['routers.reset']);
        });

        describe('trigger url events', function () {
            // it('excludes url if contains canonical_url meta', function () {
            //     eventsToRemember['url.added']({
            //         url: {
            //             relative: '/link-to-article/',
            //             absolute: 'https://myblog.com/link-to-article/'
            //         },
            //         resource: {
            //             config: {
            //                 type: 'posts'
            //             },
            //             data: {
            //                 canonical_url: 'https://external-link.com/some-article/'
            //             }
            //         }
            //     });
            //     // @NOTE: we don't call addUrl if canonical_url is present
            //     PostGenerator.prototype.addUrl.calledOnce.should.be.false();
            // });

            it('url.added', function () {
                eventsToRemember['url.added']({
                    url: {
                        relative: '/test/',
                        absolute: 'https://myblog.com/test/'
                    },
                    resource: {
                        config: {
                            type: 'posts'
                        },
                        data: {}
                    }
                });

                PostGenerator.prototype.addUrl.calledOnce.should.be.true();
            });

            it('url.removed', function () {
                eventsToRemember['url.removed']({
                    url: {
                        relative: '/test/',
                        absolute: 'https://myblog.com/test/'
                    },
                    resource: {
                        config: {
                            type: 'posts'
                        },
                        data: {}
                    }
                });

                PostGenerator.prototype.removeUrl.calledOnce.should.be.true();
            });

            it('Listens to URLResourceUpdatedEvent event', async function () {
                sinon.stub(PostGenerator.prototype, 'updateURL').resolves(true);
                DomainEvents.dispatch(URLResourceUpdatedEvent.create({
                    id: 'post_id',
                    resourceType: 'posts'
                }));
                await DomainEvents.allSettled();

                assert.ok(PostGenerator.prototype.updateURL.calledOnce);
            });
        });

        it('fn: getSiteMapXml', function () {
            PostGenerator.prototype.getXml.returns('xml');
            manager.getSiteMapXml('posts').should.eql('xml');
            PostGenerator.prototype.getXml.calledOnce.should.be.true();
        });

        it('fn: getIndexXml', function () {
            IndexGenerator.prototype.getXml.returns('xml');
            manager.getIndexXml().should.eql('xml');
            IndexGenerator.prototype.getXml.calledOnce.should.be.true();
        });
    });
});
