const _ = require('lodash');
const common = require('../../lib/common');
const models = require('../../models');

/**
 * Returns setup status
 *
 * @return {Promise<Boolean>}
 */
async function checkIsSetup() {
    return models.User.isSetup();
}

/**
 * Allows an assertion to be made about setup status.
 *
 * @param  {Boolean} status True: setup must be complete. False: setup must not be complete.
 * @return {Function} returns a "task ready" function
 */
function assertSetupCompleted(status) {
    return async function checkPermission(__) {
        const isSetup = await checkIsSetup();

        if (isSetup === status) {
            return __;
        }

        const completed = common.i18n.t('errors.api.authentication.setupAlreadyCompleted');
        const notCompleted = common.i18n.t('errors.api.authentication.setupMustBeCompleted');

        function throwReason(reason) {
            throw new common.errors.NoPermissionError({message: reason});
        }

        if (isSetup) {
            throwReason(completed);
        } else {
            throwReason(notCompleted);
        }
    };
}

function setupUser(userData) {
    const context = {context: {internal: true}},
        User = models.User;

    return User.findOne({role: 'Owner', status: 'all'}).then((owner) => {
        if (!owner) {
            throw new common.errors.GhostError({
                message: common.i18n.t('errors.api.authentication.setupUnableToRun')
            });
        }

        return User.setup(userData, _.extend({id: owner.id}, context));
    }).then((user) => {
        return {
            user: user,
            userData: userData
        };
    });
}

module.exports = {
    checkIsSetup: checkIsSetup,
    assertSetupCompleted: assertSetupCompleted,
    setupUser: setupUser
};
