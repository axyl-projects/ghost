var debug = require('debug')('ghost:app'),
    express = require('express'),

    // app requires
    config          = require('./config'),

    // middleware
    compress        = require('compression'),
    netjet          = require('netjet'),

    // local middleware
    ghostLocals     = require('./middleware/ghost-locals'),
    logRequest      = require('./middleware/log-request');

module.exports = function setupParentApp() {
    debug('ParentApp setup start');
    var parentApp = express();

    // ## Global settings

    // Make sure 'req.secure' is valid for proxied requests
    // (X-Forwarded-Proto header will be checked, if present)
    parentApp.enable('trust proxy');

    parentApp.use(logRequest);

    if (debug.enabled) {
        // debug keeps a timer, so this is super useful
        parentApp.use((function () {
            var reqDebug = require('debug')('ghost:req');
            return function debugLog(req, res, next) {
                reqDebug('Request', req.originalUrl);
                next();
            };
        })());
    }

    // enabled gzip compression by default
    if (config.get('compress') !== false) {
        parentApp.use(compress());
    }

    // Preload link headers
    if (config.get('preloadHeaders')) {
        parentApp.use(netjet({
            cache: {
                max: config.get('preloadHeaders')
            }
        }));
    }

    // This sets global res.locals which are needed everywhere
    parentApp.use(ghostLocals);

    // @TODO where should this live?!
    // Load helpers
    require('./helpers').loadCoreHelpers();
    debug('Helpers done');

    // Mount the  apps on the parentApp
    // API
    // @TODO: finish refactoring the API app
    // @TODO: decide what to do with these paths - config defaults? config overrides?
    parentApp.use('/ghost/api/v0.1/', require('./api/app')());

    // ADMIN
    parentApp.use('/ghost', require('./admin')());

    // BLOG
    parentApp.use(require('./blog')());

    debug('ParentApp setup end');

    return parentApp;
};
