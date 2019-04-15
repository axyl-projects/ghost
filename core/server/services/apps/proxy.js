const helpers = require('../../helpers/register');
const filters = require('../../filters');
const common = require('../../lib/common');
const routingService = require('../routing');

module.exports.getInstance = function getInstance(name) {
    if (!name) {
        throw new Error(common.i18n.t('errors.apps.mustProvideAppName.error'));
    }

    const appRouter = routingService.registry.getRouter('appRouter');

    return {
        filters: {
            register: filters.registerFilter.bind(filters),
            deregister: filters.deregisterFilter.bind(filters)
        },
        helpers: {
            register: helpers.registerThemeHelper.bind(helpers),
            registerAsync: helpers.registerAsyncThemeHelper.bind(helpers)
        },
        // Expose the route service...
        routeService: {
            // This allows for mounting an entirely new Router at a path...
            registerRouter: appRouter.mountRouter.bind(appRouter)
        }
    };
};
