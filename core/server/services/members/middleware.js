const common = require('../../lib/common');
const config = require('../../config');
const labsService = require('../labs');
const membersService = require('./index');
const urlUtils = require('../../lib/url-utils');
const ghostVersion = require('../../lib/ghost-version');
const settingsCache = require('../settings/cache');

// @TODO: This piece of middleware actually belongs to the frontend, not to the member app
// Need to figure a way to separate these things (e.g. frontend actually talks to members API)
const loadMemberSession = async function (req, res, next) {
    if (!labsService.isSet('members')) {
        req.member = null;
        return next();
    }
    try {
        const member = await membersService.ssr.getMemberDataFromSession(req, res);
        Object.assign(req, {member});
        res.locals.member = req.member;
        next();
    } catch (err) {
        common.logging.warn(err.message);
        Object.assign(req, {member: null});
        next();
    }
};

const getIdentityToken = async function (req, res) {
    try {
        const token = await membersService.ssr.getIdentityTokenForMemberFromSession(req, res);
        res.writeHead(200);
        res.end(token);
    } catch (err) {
        common.logging.warn(err.message);
        res.writeHead(err.statusCode);
        res.end(err.message);
    }
};

const deleteSession = async function (req, res) {
    try {
        await membersService.ssr.deleteSession(req, res);
        res.writeHead(204);
        res.end();
    } catch (err) {
        common.logging.warn(err.message);
        res.writeHead(err.statusCode);
        res.end(err.message);
    }
};

const getMemberData = async function (req, res) {
    try {
        const member = await membersService.ssr.getMemberDataFromSession(req, res);
        if (member) {
            res.json({
                uuid: member.uuid,
                email: member.email,
                name: member.name,
                firstname: member.name && member.name.split(' ')[0],
                avatar_image: member.avatar_image,
                subscriptions: member.stripe.subscriptions,
                paid: member.stripe.subscriptions.length !== 0
            });
        } else {
            res.json(null);
        }
    } catch (err) {
        common.logging.warn(err.message);
        res.writeHead(err.statusCode);
        res.end(err.message);
    }
};

const getMemberSiteData = async function (req, res) {
    const response = {
        title: settingsCache.get('title'),
        description: settingsCache.get('description'),
        logo: settingsCache.get('logo'),
        brand: settingsCache.get('brand'),
        url: urlUtils.urlFor('home', true),
        version: ghostVersion.safe,
        plans: membersService.config.getPublicPlans(),
        allowSelfSignup: membersService.config.getAllowSelfSignup()
    };

    // Brand is currently an experimental feature
    if (!config.get('enableDeveloperExperiments')) {
        delete response.brand;
    }

    res.json({site: response});
};

const createSessionFromMagicLink = async function (req, res, next) {
    if (!req.url.includes('token=')) {
        return next();
    }
    try {
        await membersService.ssr.exchangeTokenForSession(req, res);

        // req.query is a plain object, copy it to a URLSearchParams object so we can call toString()
        const searchParams = new URLSearchParams('');
        Object.keys(req.query).forEach((param) => {
            // don't copy the token param
            if (param !== 'token') {
                searchParams.set(param, req.query[param]);
            }
        });

        // We need to include the subdirectory, but members is already removed from the path
        let redirectPath = `${urlUtils.getSubdir()}${req.path}?${searchParams.toString()}`;

        // Do a standard 302 redirect
        res.redirect(redirectPath);
    } catch (err) {
        common.logging.warn(err.message);
        return next();
    }
};

// Set req.member & res.locals.member if a cookie is set
module.exports = {
    loadMemberSession,
    createSessionFromMagicLink,
    getIdentityToken,
    getMemberData,
    getMemberSiteData,
    deleteSession,
    stripeWebhooks: (req, res, next) => membersService.api.middleware.handleStripeWebhook(req, res, next)
};
