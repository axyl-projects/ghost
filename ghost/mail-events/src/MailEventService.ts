const crypto = require('crypto');
const errors = require('@tryghost/errors');
const tpl = require('@tryghost/tpl');

import MailEvent from './MailEvent';
import MailEventRepository from './MailEventRepository';

/**
 * @see https://documentation.mailgun.com/en/latest/user_manual.html#events-1
 */
enum EventType {
    CLICKED = 'clicked',
    COMPLAINED = 'complained',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    OPENED = 'opened',
    UNSUBSCRIBED = 'unsubscribed'
}

interface PayloadEvent {
    id: string;
    timestamp: number; // Unix timestamp in seconds
    event: string;
    message: {
        headers: {
            'message-id': string;
        }
    },
    recipient: string;
}

interface Payload {
    signature: string;
    events: PayloadEvent[];
}

const VALIDATION_MESSAGES = {
    serviceNotConfigured: 'MailEventService is not configured',
    payloadSignatureMissing: 'Payload is missing "signature"',
    payloadSignatureInvalid: '"signature" is invalid',
    payloadEventsMissing: 'Payload is missing "events"',
    payloadEventsInvalid: '"events" is not an array',
    payloadEventKeyMissing: 'Event [{idx}] is missing "{key}"'
};

export default class MailEventService {
    constructor(
        private eventRepository: MailEventRepository,
        private payloadSigningKey: string
    ) {}

    async processPayload(payload: Payload) {
        // Verify that the service is configured correctly - We expect a string
        // for the payload signing key but as a safeguard we check the type here
        // to prevent any unexpected behaviour if anything else is passed in
        if (typeof this.payloadSigningKey !== 'string') {
            throw new errors.InternalServerError({
                message: tpl(VALIDATION_MESSAGES.serviceNotConfigured)
            });
        }

        // Validate the payload
        this.validatePayload(payload);

        // Verify the payload
        await this.verifyPayload(payload);

        // Persist known events
        const eventTypes = new Set<string>(Object.values(EventType) as string[]);

        for (const payloadEvent of payload.events) {
            if (eventTypes.has(payloadEvent.event) === false) {
                continue;
            }

            try {
                await this.eventRepository.persist(
                    new MailEvent(
                        payloadEvent.id,
                        payloadEvent.event,
                        payloadEvent.message.headers['message-id'],
                        payloadEvent.recipient,
                        payloadEvent.timestamp * 1000
                    )
                );
            } catch (err) {
                throw new errors.InternalServerError({
                    message: 'Event could not be persisted',
                    err: err
                });
            }
        }
    }

    private async verifyPayload(payload: Payload) {
        const data = JSON.stringify(payload.events);

        const signature = crypto
            .createHmac('sha256', this.payloadSigningKey)
            .update(data)
            .digest('hex');

        if (signature !== payload.signature) {
            throw new errors.UnauthorizedError({
                message: tpl(VALIDATION_MESSAGES.payloadSignatureInvalid)
            });
        }
    }

    private validatePayload(payload: Payload) {
        if (payload.signature === undefined) {
            throw new errors.ValidationError({
                message: tpl(VALIDATION_MESSAGES.payloadSignatureMissing)
            });
        }

        if (typeof payload.signature !== 'string') {
            throw new errors.ValidationError({
                message: tpl(VALIDATION_MESSAGES.payloadSignatureInvalid)
            });
        }

        if (payload.events === undefined) {
            throw new errors.ValidationError({
                message: tpl(VALIDATION_MESSAGES.payloadEventsMissing)
            });
        }

        if (Array.isArray(payload.events) === false) {
            throw new errors.ValidationError({
                message: tpl(VALIDATION_MESSAGES.payloadEventsInvalid)
            });
        }

        const expectedKeys: (keyof PayloadEvent)[] = ['id', 'timestamp', 'event', 'message', 'recipient'];

        for (const [idx, payloadEvent] of payload.events.entries()) {
            for (const key of expectedKeys) {
                if (payloadEvent[key] === undefined) {
                    throw new errors.ValidationError({
                        message: tpl(VALIDATION_MESSAGES.payloadEventKeyMissing, {idx, key})
                    });
                }

                if (key === 'message' && payloadEvent.message?.headers?.['message-id'] === undefined) {
                    throw new errors.ValidationError({
                        message: tpl(VALIDATION_MESSAGES.payloadEventKeyMissing, {idx, key: 'message.headers.message-id'})
                    });
                }
            }
        }
    }
}
