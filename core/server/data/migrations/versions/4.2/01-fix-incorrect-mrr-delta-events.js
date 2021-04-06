const {createTransactionalMigration} = require('../../utils');
const logging = require('../../../../../shared/logging');

module.exports = createTransactionalMigration(
    async function up(knex) {
        logging.info('Fixing incorrect mrr_delta in members_paid_subscription_events table');
        await knex.raw('UPDATE members_paid_subscription_events SET mrr_delta = mrr_delta / 2 WHERE from_plan = to_plan');
    },
    async function down() {
        // noop
    }
);
