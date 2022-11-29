const assert = require('assert');
const ObjectID = require('bson-objectid').default;
const EmailBouncedEvent = require('../../lib/EmailBouncedEvent');

describe('EmailBouncedEvent', function () {
    it('exports a static create method to create instances', function () {
        const event = EmailBouncedEvent.create({
            email: 'test@test.test',
            memberId: new ObjectID().toHexString(),
            emailId: new ObjectID().toHexString(),
            emailRecipientId: new ObjectID().toHexString(),
            timestamp: new Date()
        });
        assert(event instanceof EmailBouncedEvent);
    });
});
