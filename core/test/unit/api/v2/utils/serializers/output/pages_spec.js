const should = require('should');
const sinon = require('sinon');
const testUtils = require('../../../../../../utils');
const mapper = require('../../../../../../../server/api/v2/utils/serializers/output/utils/mapper');
const serializers = require('../../../../../../../server/api/v2/utils/serializers');

const sandbox = sinon.sandbox.create();

describe('Unit: v2/utils/serializers/output/pages', () => {
    let pageModel;

    beforeEach(() => {
        pageModel = (data) => {
            return Object.assign(data, {toJSON: sandbox.stub().returns(data)});
        };

        sandbox.stub(mapper, 'mapPost').returns({});
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('calls the mapper', () => {
        const apiConfig = {};
        const frame = {
            options: {
                withRelated: ['tags', 'authors'],
                context: {
                    private: false
                }
            }
        };

        const ctrlResponse = {
            data: [
                pageModel(testUtils.DataGenerator.forKnex.createPost({
                    id: 'id1',
                    page: true
                })),
                pageModel(testUtils.DataGenerator.forKnex.createPost({
                    id: 'id2',
                    page: true
                }))
            ],
            meta: {}
        };

        serializers.output.pages.all(ctrlResponse, apiConfig, frame);

        mapper.mapPost.callCount.should.equal(2);
        mapper.mapPost.getCall(0).args.should.eql([ctrlResponse.data[0], frame]);
    });
});
