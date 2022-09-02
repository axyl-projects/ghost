const settingsService = require('../settings/settings-service');

class StaffServiceWrapper {
    init() {
        const StaffService = require('@tryghost/staff-service');

        const logging = require('@tryghost/logging');
        const models = require('../../models');
        const {GhostMailer} = require('../mail');
        const mailer = new GhostMailer();
        const settingsCache = require('../../../shared/settings-cache');
        const urlUtils = require('../../../shared/url-utils');
        const settingsHelpers = settingsService.helpers;

        this.api = new StaffService({
            logging,
            models,
            mailer,
            settingsHelpers,
            settingsCache,
            urlUtils
        });
    }
}

module.exports = new StaffServiceWrapper();
