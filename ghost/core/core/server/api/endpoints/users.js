const tpl = require('@tryghost/tpl');
const errors = require('@tryghost/errors');
const models = require('../../models');
const permissionsService = require('../../services/permissions');
const dbBackup = require('../../data/db/backup');
const auth = require('../../services/auth');
const apiMail = require('./index').mail;
const apiSettings = require('./index').settings;
const UsersService = require('../../services/Users');
const userService = new UsersService({dbBackup, models, auth, apiMail, apiSettings});
const ALLOWED_INCLUDES = ['count.posts', 'permissions', 'roles', 'roles.permissions'];
const UNSAFE_ATTRS = ['status', 'roles'];

const messages = {
    noPermissionToAction: 'You do not have permission to perform this action',
    userNotFound: 'User not found.'
};

function permissionOnlySelf(frame) {
    const targetId = getTargetId(frame);
    const userId = frame.user.id;
    if (targetId !== userId) {
        return Promise.reject(new errors.NoPermissionError({message: tpl(messages.noPermissionToAction)}));
    }
    return Promise.resolve();
}

function getTargetId(frame) {
    return frame.options.id === 'me' ? frame.user.id : frame.options.id;
}

async function fetchOrCreatePersonalToken(userId) {
    const token = await models.ApiKey.findOne({user_id: userId}, {});

    if (!token) {
        const newToken = await models.ApiKey.add({user_id: userId, type: 'admin'});
        return newToken;
    }

    return token;
}

const shouldInvalidateCacheAfterChange = (model) => {
    // Model attributes that should not trigger cache invalidation when changed
    // (because they have no effect on the frontend)
    const privateAttrs = [
        'id',
        'password',
        'email',
        'accessibility',
        'status',
        'locale',
        'visibility',
        'last_seen',
        'tour',
        'comment_notifications',
        'free_member_signup_notification',
        'paid_subscription_started_notification',
        'paid_subscription_canceled_notification',
        'mention_notifications',
        'recommendation_notifications',
        'milestone_notifications',
        'donation_notifications',
        'updated_at',
        'updated_by'
    ];

    if (model.wasChanged() === false) {
        return false;
    }

    // Check if any of the changed attributes are not private
    for (const attr of Object.keys(model._changed)) {
        if (privateAttrs.includes(attr) === false) {
            return true;
        }
    }

    return false;
};

module.exports = {
    docName: 'users',

    browse: {
        headers: {
            cacheInvalidate: false
        },
        options: [
            'include',
            'filter',
            'fields',
            'limit',
            'order',
            'page',
            'debug'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.User.findPage(frame.options);
        }
    },

    read: {
        headers: {
            cacheInvalidate: false
        },
        options: [
            'include',
            'filter',
            'fields',
            'debug'
        ],
        data: [
            'id',
            'slug',
            'email',
            'role'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                }
            }
        },
        permissions: true,
        query(frame) {
            return models.User.findOne(frame.data, frame.options)
                .then((model) => {
                    if (!model) {
                        return Promise.reject(new errors.NotFoundError({
                            message: tpl(messages.userNotFound)
                        }));
                    }

                    return model;
                });
        }
    },

    edit: {
        headers: {
            cacheInvalidate: false
        },
        options: [
            'id',
            'include'
        ],
        validation: {
            options: {
                include: {
                    values: ALLOWED_INCLUDES
                },
                id: {
                    required: true
                }
            }
        },
        permissions: {
            unsafeAttrs: UNSAFE_ATTRS
        },
        query(frame) {
            return models.User.edit(frame.data.users[0], frame.options)
                .then((model) => {
                    if (!model) {
                        return Promise.reject(new errors.NotFoundError({
                            message: tpl(messages.userNotFound)
                        }));
                    }

                    this.headers.cacheInvalidate = shouldInvalidateCacheAfterChange(model);

                    return model;
                });
        }
    },

    destroy: {
        headers: {
            cacheInvalidate: true
        },
        options: [
            'id'
        ],
        validation: {
            options: {
                id: {
                    required: true
                }
            }
        },
        permissions: true,
        async query(frame) {
            return userService.destroyUser(frame.options).catch((err) => {
                return Promise.reject(new errors.NoPermissionError({
                    err: err
                }));
            });
        }
    },

    changePassword: {
        headers: {
            cacheInvalidate: false
        },
        validation: {
            docName: 'password',
            data: {
                newPassword: {required: true},
                ne2Password: {required: true},
                user_id: {required: true}
            }
        },
        permissions: {
            docName: 'user',
            method: 'edit',
            identifier(frame) {
                return frame.data.password[0].user_id;
            }
        },
        query(frame) {
            frame.options.skipSessionID = frame.original.session.id;
            return models.User.changePassword(frame.data.password[0], frame.options);
        }
    },

    transferOwnership: {
        headers: {
            cacheInvalidate: false
        },
        permissions(frame) {
            return models.Role.findOne({name: 'Owner'})
                .then((ownerRole) => {
                    return permissionsService.canThis(frame.options.context).assign.role(ownerRole);
                });
        },
        query(frame) {
            return models.User.transferOwnership(frame.data.owner[0], frame.options);
        }
    },

    readToken: {
        headers: {
            cacheInvalidate: false
        },
        options: [
            'id'
        ],
        validation: {
            options: {
                id: {
                    required: true
                }
            }
        },
        permissions: permissionOnlySelf,
        query(frame) {
            const targetId = getTargetId(frame);
            return fetchOrCreatePersonalToken(targetId);
        }
    },

    regenerateToken: {
        headers: {
            cacheInvalidate: false
        },
        options: [
            'id'
        ],
        validation: {
            options: {
                id: {
                    required: true
                }
            }
        },
        permissions: permissionOnlySelf,
        query(frame) {
            const targetId = getTargetId(frame);
            return fetchOrCreatePersonalToken(targetId).then((model) => {
                return models.ApiKey.refreshSecret(model.toJSON(), Object.assign({}, {id: model.id}));
            });
        }
    }
};
