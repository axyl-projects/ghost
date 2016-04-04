var _              = require('lodash'),
    crypto         = require('crypto'),
    uuid           = require('uuid'),
    i18n           = require('../i18n'),
    ghostBookshelf = require('./base'),
    events         = require('../events'),
    errors         = require('../errors'),
    config         = require('../config'),
    Promise        = require('bluebird'),
    sequence       = require('../utils/sequence'),
    domainUpdate   = require('./base/utils').trustedDomainUpdate,

    Client,
    Clients;

Client = ghostBookshelf.Model.extend({

    tableName: 'clients',

    emitChange: function emitChange(event) {
        events.emit('client' + '.' + event, this);
    },

    defaults: function defaults() {
        // @TODO: we cannot delete this ugly check here, because ALL routing tests rely on a static client secret
        var env = config.get('env'),
            secret = env.indexOf('testing') !== 0 ? crypto.randomBytes(6).toString('hex') : 'not_available';

        return {
            uuid: uuid.v4(),
            secret: secret,
            status: 'development',
            type: 'ua'
        };
    },

    initialize: function initialize() {
        var self = this;

        ghostBookshelf.Model.prototype.initialize.apply(this, arguments);

        this.on('saved', function onSaved(model, response, options) {
            return self.updateTrustedDomains(model, response, options);
        });

        this.on('created', function onCreated(model) {
            model.emitChange('added');
        });

        this.on('updated', function onUpdated(model) {
            model.emitChange('edited');
        });

        this.on('destroyed', function onDestroyed(model) {
            model.emitChange('deleted');
        });
    },

    saving: function saving(model, attr, options) {
        var self = this,
            secret,
            status,
            domainsToCheck,
            context,
            i;

        options = options || {};
        context = options.context || {};

        // keep trusted domains for 'saved' event and deduplicate upper/lowercase trusted domains
        domainsToCheck = this.get('trusted_domains');
        if (domainsToCheck) {
            this.myTrustedDomains = [];

            _.each(domainsToCheck, function each(item) {
                for (i = 0; i < self.myTrustedDomains.length; i = i + 1) {
                    if (self.myTrustedDomains[i].trusted_domain.toLocaleLowerCase() === item.trusted_domain.toLocaleLowerCase()) {
                        return;
                    }
                }

                self.myTrustedDomains.push(item);
            });
        }

        ghostBookshelf.Model.prototype.saving.call(this, model, attr, options);

        secret = this.get('secret') || crypto.randomBytes(6).toString('hex');
        this.set('secret', secret.trim());

        status = this.get('status') || 'enabled';
        this.set('status', status.trim());

        if (!context.internal && (this.hasChanged('slug') || !this.get('slug'))) {
            // Pass the new slug through the generator to strip illegal characters, detect duplicates
            return ghostBookshelf.Model.generateSlug(Client, this.get('slug') || this.get('name'),
                {transacting: options.transacting})
                .then(function then(slug) {
                    self.set({slug: slug});
                });
        }
    },

    /**
     * ### updateTrustedDomains
     * Update domains that are attached to a client. Create any domains that don't already exist.
     * @param {Object} savedModel
     * @param {Object} response
     * @param {Object} options
     * @return {Promise(ghostBookshelf.Models.Client)} Updated Client model
     */
    updateTrustedDomains: function updateTrustedDomains(savedModel, response, options) {
        var newDomains = this.myTrustedDomains,
            DomainModel = ghostBookshelf.model('ClientTrustedDomain');

        if (!newDomains) {
            // no new domains don't delete old domains
            return;
        }

        options = options || {};

        function doDomainUpdates(options) {
            return Promise.props({
                currentClient: domainUpdate.fetchCurrentClient(Client, savedModel.id, options),
                existingDomains: domainUpdate.fetchMatchingDomains(DomainModel, newDomains, options)
            }).then(function fetchedData(results) {
                var currentDomains = results.currentClient.related('trusted_domains').toJSON(options),
                    existingDomains = results.existingDomains ? results.existingDomains.toJSON(options) : [],
                    domainOps = [],
                    domainsToRemove,
                    domainsToCreate;

                if (domainUpdate.domainSetsAreEqual(newDomains, currentDomains)) {
                    return;
                }

                // Domains from the current domain array which don't exist in the new domain array should be removed
                domainsToRemove = _.reject(currentDomains, function (currentDomain) {
                    if (newDomains.length === 0) {
                        return false;
                    }
                    return _.any(newDomains, function (newDomain) {
                        return domainUpdate.domainsAreEqual(currentDomain, newDomain);
                    });
                });

                // Domains from the new domain array which don't exist in the DB should be created
                domainsToCreate = _.pluck(_.reject(newDomains, function (newDomain) {
                    return _.any(existingDomains, function (existingDomain) {
                        return domainUpdate.domainsAreEqual(existingDomain, newDomain);
                    });
                }), 'trusted_domain');

                // Remove any domains which don't exist anymore
                _.each(domainsToRemove, function (domain) {
                    domainOps.push(domainUpdate.removeDomain(DomainModel, savedModel, domain, options));
                });

                // Loop through the new domains and either add them, attach them, or update them
                _.each(newDomains, function (newDomain) {
                    if (domainsToCreate.indexOf(newDomain.trusted_domain) > -1) {
                        domainOps.push(domainUpdate.createDomain(DomainModel, savedModel, newDomain, options));
                    }
                });

                return sequence(domainOps);
            });
        }

        // Handle updating domains in a transaction, unless we're already in one
        if (options.transacting) {
            return doDomainUpdates(options);
        } else {
            return ghostBookshelf.transaction(function (t) {
                options.transacting = t;

                return doDomainUpdates(options);
            }).then(function () {
                // Don't do anything, the transaction processed ok
            }).catch(function failure(error) {
                errors.logError(
                    error,
                    i18n.t('errors.models.client.trustedDomainUpdates.error'),
                    i18n.t('errors.models.client.trustedDomainUpdates.help')
                );
                return Promise.reject(new errors.InternalServerError(
                    i18n.t('errors.models.client.trustedDomainUpdates.error') + ' ' +
                        i18n.t('errors.models.client.trustedDomainUpdates.help') + error
                ));
            });
        }
    },

    trusted_domains: function trustedDomains() {
        return this.hasMany('ClientTrustedDomain', 'client_id');
    }
}, {
    orderDefaultOptions: function orderDefaultOptions() {
        return {};
    },

    /**
     * @deprecated in favour of filter
     */
    processOptions: function processOptions(options) {
        return options;
    },

    /**
    * Returns an array of keys permitted in a method's `options` hash, depending on the current method.
    * @param {String} methodName The name of the method to check valid options for.
    * @return {Array} Keys allowed in the `options` hash of the model's method.
    */
    permittedOptions: function permittedOptions(methodName) {
        var options = ghostBookshelf.Model.permittedOptions(),

            // whitelists for the `options` hash argument on methods, by method name.
            // these are the only options that can be passed to Bookshelf / Knex.
            validOptions = {
                findOne: ['columns', 'withRelated']
            };

        if (validOptions[methodName]) {
            options = options.concat(validOptions[methodName]);
        }

        return options;
    },

    /**
     * Filters potentially unsafe model attributes, so you can pass them to Bookshelf / Knex.
     * @param {Object} data Has keys representing the model's attributes/fields in the database.
     * @return {Object} The filtered results of the passed in data, containing only what's allowed in the schema.
     */
    filterData: function filterData(data) {
        var permittedAttributes = this.prototype.permittedAttributes(),
            filteredData;

        // manually add 'trusted_domains' attribute since it's not in the schema
        permittedAttributes.push('trusted_domains');

        filteredData = _.pick(data, permittedAttributes);

        return filteredData;
    },

    /**
     * ### Edit
     * @extends ghostBookshelf.Model.edit to handle returning the full object
     * **See:** [ghostBookshelf.Model.edit](base.js.html#edit)
     */
    edit: function edit(data, options) {
        var self = this,
            frontendAllowedFields = ['secret', 'status'],
            slug;
        options = options || {};

        return self.findOne({id: options.id}, options).then(function then(client) {
            if (!client) {
                return Promise.reject(new errors.NotFoundError(i18n.t('errors.models.client.noClientFound')));
            }

            slug = client.get('slug');

            if (slug === 'ghost-admin') {
                // can't edit "ghost-admin" Client
                return Promise.reject(new errors.BadRequestError(i18n.t('errors.models.client.cantEditGhostAdmin')));
            } else if (slug === 'ghost-frontend') {
                // only can change 'secret' and/or 'status'
                if (_.difference(_.keys(data), frontendAllowedFields).length) {
                    return Promise.reject(new errors.BadRequestError(i18n.t('errors.models.client.cantEditGhostFrontend')));
                }
            }

            return ghostBookshelf.Model.edit.call(self, data, options).then(function then() {
                return self.findOne({id: options.id}, options);
            });
        });
    },

    /**
     * ### Add
     * @extends ghostBookshelf.Model.add to handle returning the full object
     * **See:** [ghostBookshelf.Model.add](base.js.html#add)
     */
    add: function add(data, options) {
        var self = this;
        options = options || {};

        return ghostBookshelf.Model.add.call(this, data, options).then(function then(client) {
            return self.findOne({id: client.id}, options);
        });
    },

    /**
     * ### Destroy
     * @extends ghostBookshelf.Model.destroy to clean up trusted domain relations
     * **See:** [ghostBookshelf.Model.destroy](base.js.html#destroy)
     */
    destroy: function destroy(options) {
        var id = options.id;
        options = this.filterOptions(options, 'destroy');

        return this.forge({id: id}).fetch({withRelated: ['trusted_domains']}).then(function destroyTrustedDomains(client) {
            var slug = client.get('slug');

            if (slug === 'ghost-admin' || slug === 'ghost-frontend') {
                return Promise.reject(new errors.BadRequestError(i18n.t('errors.models.client.cantDeleteProtectedClients')));
            }

            return client.related('trusted_domains').invokeThen('destroy').then(function destroyClients() {
                return client.destroy(options);
            });
        });
    }
});

Clients = ghostBookshelf.Collection.extend({
    model: Client
});

module.exports = {
    Client: ghostBookshelf.model('Client', Client),
    Clients: ghostBookshelf.collection('Clients', Clients)
};
