const _ = require('lodash');
const common = require('../../lib/common');
const models = require('../../models');
const pipeline = require('../../../server/lib/promise/pipeline');
const request = require('../../../server/lib/request');

function makeRequests(webhooksCollection, payload, options) {
    _.each(webhooksCollection.models, (webhook) => {
        const event = webhook.get('event');
        const targetUrl = webhook.get('target_url');
        const webhookId = webhook.get('id');
        const reqPayload = JSON.stringify(payload);

        common.logging.info('webhook.trigger', event, targetUrl);
        request(targetUrl, {
            body: reqPayload,
            headers: {
                'Content-Length': Buffer.byteLength(reqPayload),
                'Content-Type': 'application/json'
            },
            timeout: 2 * 1000,
            retries: 5
        }).catch((err) => {
            // when a webhook responds with a 410 Gone response we should remove the hook
            if (err.statusCode === 410) {
                common.logging.info('webhook.destroy (410 response)', event, targetUrl);
                return models.Webhook.destroy({id: webhookId}, options);
            }

            common.logging.error(new common.errors.GhostError({
                err: err,
                context: {
                    id: webhookId,
                    event: event,
                    target_url: targetUrl,
                    payload: payload
                }
            }));
        });
    });
}

function trigger(event, payload, options) {
    let tasks;

    function doQuery(options) {
        return models.Webhook.findAllByEvent(event, options);
    }

    tasks = [
        doQuery,
        _.partialRight(makeRequests, payload, options)
    ];

    return pipeline(tasks, options);
}

module.exports = trigger;