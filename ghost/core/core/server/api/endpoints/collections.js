const errors = require('@tryghost/errors');
const tpl = require('@tryghost/tpl');
const collectionsService = require('../../services/collections');

const messages = {
    collectionNotFound: 'Collection not found.'
};

module.exports = {
    docName: 'collections',

    browse: {
        options: [
            'limit',
            'order',
            'page'
        ],
        // @NOTE: should have permissions when moving out of Alpha
        permissions: false,
        query(frame) {
            return collectionsService.api.browse(frame.options);
        }
    },

    add: {
        statusCode: 201,
        headers: {
            cacheInvalidate: true
        },
        // @NOTE: should have permissions when moving out of Alpha
        permissions: false,
        async query(frame) {
            return await collectionsService.api.add(frame.data.collections[0], frame.options);
        }
    },

    edit: {
        headers: {},
        options: [
            'id'
        ],
        validation: {
            options: {
                id: {
                    required: true
                }
            }
        },
        // @NOTE: should have permissions when moving out of Alpha
        permissions: false,
        async query(frame) {
            const model = await collectionsService.api.edit(frame.data.collections[0], frame.options);

            if (!model) {
                return Promise.reject(new errors.NotFoundError({
                    message: tpl(messages.tagNotFound)
                }));
            }

            // @NOTE: cache invalidation has to be done manually for now
            //        because the model's wasChanged is not returned from
            //        the service using in-memory repository layer
            // if (model.wasChanged()) {
            this.headers.cacheInvalidate = true;
            // } else {
            //     this.headers.cacheInvalidate = false;
            // }

            return model;
        }
    }
};
