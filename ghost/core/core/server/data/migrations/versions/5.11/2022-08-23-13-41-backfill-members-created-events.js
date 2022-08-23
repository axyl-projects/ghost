const ObjectID = require('bson-objectid').default;
const logging = require('@tryghost/logging');

const {createTransactionalMigration} = require('../../utils');

module.exports = createTransactionalMigration(
    async function up(knex) {
        const members = await knex('members')
            .select('id', 'created_at');

        const toInsert = [];

        // eslint-disable-next-line no-restricted-syntax
        for (const member of members) {
            toInsert.push({
                id: ObjectID().toHexString(),
                member_id: member.id,
                created_at: member.created_at,
                source: 'member'
            });
        }

        logging.info(`Inserting ${toInsert.length} members created events`);
        await knex.batchInsert('members_created_events', toInsert);
    },
    async function down(knex) {
        logging.info(`Clearing all members created events`);
        await knex('members_created_events').truncate();
    }
);
