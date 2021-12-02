const should = require('should');
const sinon = require('sinon');
const urlUtils = require('../../../../../../../core/shared/url-utils');
const url = require('../../../../../../../core/server/api/canary/utils/serializers/input/utils/url');

describe('Unit: canary/utils/serializers/input/utils/url', function () {
    describe('forPost', function () {
        beforeEach(function () {
            sinon.stub(urlUtils, 'getSiteUrl')
                .returns('https://blogurl.com');
        });

        afterEach(function () {
            sinon.restore();
        });
    });
});
