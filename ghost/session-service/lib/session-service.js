const {
    BadRequestError
} = require('@tryghost/errors');

/**
 * @typedef {object} User
 * @prop {string} id
 */

/**
 * @typedef {object} Session
 * @prop {(cb: (err: Error | null) => any) => void} destroy
 * @prop {string} user_id
 * @prop {string} origin
 * @prop {string} user_agent
 * @prop {string} ip
 * @prop {boolean} verified
 */

/**
 * @typedef {import('express').Request} Req
 * @typedef {import('express').Response} Res
 */

/**
 * @typedef {object} SessionService
 * @prop {(req: Req, res: Res) => Promise<User | null>} getUserForSession
 * @prop {(req: Req, res: Res) => Promise<void>} removeUserForSession
 * @prop {(req: Req, res: Res, user: User) => Promise<void>} createSessionForUser
 * @prop {(req: Req, res: Res) => Promise<void>} verifySession
 * @prop {(req: Req, res: Res) => Promise<void>} sendAuthCodeToUser
 * @prop {(req: Req, res: Res) => string} generateAuthCodeForUser
 * @prop {(req: Req, res: Res) => Promise<void>} verifyAuthCodeForUser
 */

/**
 * @param {object} deps
 * @param {(req: Req, res: Res) => Promise<Session>} deps.getSession
 * @param {(data: {id: string}) => Promise<User>} deps.findUserById
 * @param {(req: Req) => string} deps.getOriginOfRequest
 *
 * @returns {SessionService}
 */

module.exports = function createSessionService({getSession, findUserById, getOriginOfRequest}) {
    /**
     * cookieCsrfProtection
     *
     * @param {Req} req
     * @param {Session} session
     * @returns {Promise<void>}
     */
    function cookieCsrfProtection(req, session) {
        // If there is no origin on the session object it means this is a *new*
        // session, that hasn't been initialised yet. So we don't need CSRF protection
        if (!session.origin) {
            return;
        }

        const origin = getOriginOfRequest(req);

        if (session.origin !== origin) {
            throw new BadRequestError({
                message: `Request made from incorrect origin. Expected '${session.origin}' received '${origin}'.`
            });
        }
    }

    /**
     * createSessionForUser
     *
     * @param {Req} req
     * @param {Res} res
     * @param {User} user
     * @returns {Promise<void>}
     */
    async function createSessionForUser(req, res, user) {
        const session = await getSession(req, res);
        const origin = getOriginOfRequest(req);
        if (!origin) {
            throw new BadRequestError({
                message: 'Could not determine origin of request. Please ensure an Origin or Referrer header is present.'
            });
        }

        session.user_id = user.id;
        session.origin = origin;
        session.user_agent = req.get('user-agent');
        session.ip = req.ip;
    }

    /**
     * generateAuthCodeForUser
     *
     * @param {Req} req
     * @param {Res} res
     * @returns {string}
     */
    async function generateAuthCodeForUser(req, res) {
        return '123456';
        
    }

    /**
     * verifyAuthCodeForUser
     *
     * @param {Req} req
     * @param {Res} res
     * @returns {Promise<void>}
     */
    async function verifyAuthCodeForUser(req, res) {
        
        
    }

    /**
     * sendAuthCodeToUser
     *
     * @param {Req} req
     * @param {Res} res
     * @returns {Promise<void>}
     */
    async function sendAuthCodeToUser(req, res) {
        generateAuthCodeForUser();
        // send auth code to user
    }

    /**
     * verifySession
     *
     * @param {Req} req
     * @param {Res} res
     */
    async function verifySession(req, res) {
        const session = await getSession(req, res);
        session.verified = true;
    }

    /**
     * removeUserForSession
     *
     * @param {Req} req
     * @param {Res} res
     * @returns {Promise<void>}
     */
    async function removeUserForSession(req, res) {
        const session = await getSession(req, res);
        session.user_id = undefined;
    }

    /**
     * getUserForSession
     *
     * @param {Req} req
     * @param {Res} res
     * @returns {Promise<User | null>}
     */
    async function getUserForSession(req, res) {
        // CASE: we don't have a cookie header so allow fallthrough to other
        // auth middleware or final "ensure authenticated" check
        if (!req.headers || !req.headers.cookie) {
            return null;
        }

        const session = await getSession(req, res);
        // Enable CSRF bypass (useful for OAuth for example)
        if (!res || !res.locals || !res.locals.bypassCsrfProtection) {
            cookieCsrfProtection(req, session);
        }

        if (!session || !session.user_id) {
            return null;
        }

        try {
            const user = await findUserById({id: session.user_id});
            return user;
        } catch (err) {
            return null;
        }
    }

    return {
        getUserForSession,
        createSessionForUser,
        removeUserForSession,
        verifySession,
        sendAuthCodeToUser,
        verifyAuthCodeForUser
    };
};
