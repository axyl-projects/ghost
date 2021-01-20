const _ = require('lodash');
const debug = require('ghost-ignition').debug('api:v2:utils:serializers:input:webhooks');

module.exports = {
    add(apiConfig, frame) {
        debug('add');

        if (_.get(frame, 'options.context.integration.id')) {
            frame.data.webhooks[0].integration_id = frame.options.context.integration.id;
        }
    }
};
