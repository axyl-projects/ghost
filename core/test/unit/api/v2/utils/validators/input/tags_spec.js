const _ = require('lodash');
const should = require('should');
const sinon = require('sinon');
const Promise = require('bluebird');
const common = require('../../../../../../../server/lib/common');
const validators = require('../../../../../../../server/api/v2/utils/validators');

describe('Unit: v2/utils/validators/input/tags', function () {
    afterEach(function () {
        sinon.restore();
    });

    describe('add', function () {
        const apiConfig = {
            docName: 'tags'
        };

        describe('required fields', function () {
            it('should fail with no data', function () {
                const frame = {
                    options: {},
                    data: {}
                };

                return validators.input.tags.add(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should fail with no tags', function () {
                const frame = {
                    options: {},
                    data: {
                        posts: []
                    }
                };

                return validators.input.tags.add(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should fail with no tags in array', function () {
                const frame = {
                    options: {},
                    data: {
                        tags: []
                    }
                };

                return validators.input.tags.add(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should fail with more than tags', function () {
                const frame = {
                    options: {},
                    data: {
                        tags: [],
                        posts: []
                    }
                };

                return validators.input.tags.add(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should fail without required fields', function () {
                const frame = {
                    options: {},
                    data: {
                        tags: [{
                            what: 'a fail'
                        }]
                    }
                };

                return validators.input.tags.add(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should pass with required fields', function () {
                const frame = {
                    options: {},
                    data: {
                        tags: [{
                            name: 'pass'
                        }]
                    }
                };

                return validators.input.tags.add(apiConfig, frame);
            });

            it('should remove `strip`able fields and leave regular fields', function () {
                const frame = {
                    options: {},
                    data: {
                        tags: [{
                            name: 'pass',
                            parent: 'strip me',
                            created_at: 'strip me',
                            created_by: 'strip me',
                            updated_at: 'strip me',
                            updated_by: 'strip me'
                        }]
                    }
                };

                let result = validators.input.tags.add(apiConfig, frame);

                should.exist(frame.data.tags[0].name);
                should.not.exist(frame.data.tags[0].parent);
                should.not.exist(frame.data.tags[0].created_at);
                should.not.exist(frame.data.tags[0].created_by);
                should.not.exist(frame.data.tags[0].updated_at);
                should.not.exist(frame.data.tags[0].updated_by);

                return result;
            });
        });

        describe('field formats', function () {
            let fieldMap,badValues, checks, tag, frame, key;
            before(function () {
                fieldMap = {
                    name: [123, new Date(), ',starts-with-coma', '', _.repeat('a', 192), null],
                    slug: [123, new Date(), _.repeat('a', 192)],
                    description: [123, new Date(), _.repeat('a', 501)],
                    feature_image: [123, new Date(), 'not uri'],
                    visibility: [123, new Date(), 'abc', null],
                    meta_title: [123, new Date(), _.repeat('a', 301)],
                    meta_description: [123, new Date(), _.repeat('a', 501)]
                };
            });

            it(`should fail for bad slug`, function () {
                badValues = fieldMap.slug;
                checks = badValues.map((value) => {
                    tag = {};
                    tag[key] = value;

                    if (key !== 'name') {
                        tag.name = 'abc';
                    }

                    frame = {
                        options: {},
                        data: {
                            tags: [tag]
                        }
                    };
                    return validators.input.tags.add(apiConfig, frame)
                        .then(Promise.reject)
                        .catch((err) => {
                            (err instanceof common.errors.ValidationError).should.be.true();
                        });
                });
                return Promise.all(checks);
            });
        });
    });    

    describe('edit', function () {
        const apiConfig = {
            docName: 'tags'
        };

        describe('required fields', function () {
            it('should fail with no data', function () {
                const frame = {
                    options: {},
                    data: {}
                };

                return validators.input.tags.edit(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should fail with no tags', function () {
                const frame = {
                    options: {},
                    data: {
                        posts: []
                    }
                };

                return validators.input.tags.edit(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should fail with more than tags', function () {
                const frame = {
                    options: {},
                    data: {
                        tags: [],
                        posts: []
                    }
                };

                return validators.input.tags.edit(apiConfig, frame)
                    .then(Promise.reject)
                    .catch((err) => {
                        (err instanceof common.errors.ValidationError).should.be.true();
                    });
            });

            it('should pass with some fields', function () {
                const frame = {
                    options: {},
                    data: {
                        tags: [{
                            name: 'pass'
                        }]
                    }
                };

                return validators.input.tags.edit(apiConfig, frame);
            });
        });
    });
});
