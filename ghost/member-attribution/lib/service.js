const UrlHistory = require('./history');
const {slugify} = require('@tryghost/string');

const blacklistedReferrerDomains = [
    // Facebook has some restrictions on the 'ref' attribute (max 15 chars + restricted character set) that breaks links if we add ?ref=longer-string
    'facebook.com',
    'www.facebook.com'
];

class MemberAttributionService {
    /**
     *
     * @param {Object} deps
     * @param {Object} deps.attributionBuilder
     * @param {Object} deps.models
     * @param {Object} deps.models.MemberCreatedEvent
     * @param {Object} deps.models.SubscriptionCreatedEvent
     * @param {() => boolean} deps.getTrackingEnabled
     * @param {() => string} deps.getSiteTitle
     */
    constructor({attributionBuilder, models, getTrackingEnabled, getSiteTitle}) {
        this.models = models;
        this.attributionBuilder = attributionBuilder;
        this._getTrackingEnabled = getTrackingEnabled;
        this._getSiteTitle = getSiteTitle;
    }

    get isTrackingEnabled() {
        return this._getTrackingEnabled();
    }

    get siteTitle() {
        return this._getSiteTitle();
    }

    /**
     *
     * @param {Object} context instance of ghost framework context object
     * @returns {Promise<import('./attribution').AttributionResource|null>}
     */
    async getAttributionFromContext(context) {
        if (!context || !this.isTrackingEnabled) {
            return null;
        }

        const source = this._resolveContextSource(context);

        // We consider only select internal context sources
        if (['import', 'api', 'admin'].includes(source)) {
            let attribution = {
                id: null,
                type: null,
                url: null,
                title: null,
                referrerUrl: null,
                referrerSource: null,
                referrerMedium: null
            };
            if (source === 'import') {
                attribution.referrerSource = 'Imported';
                attribution.referrerMedium = 'Member Importer';
            } else if (source === 'admin') {
                attribution.referrerSource = 'Created manually';
                attribution.referrerMedium = 'Ghost Admin';
            } else if (source === 'api') {
                attribution.referrerSource = 'Created via API';
                attribution.referrerMedium = 'Admin API';
            }

            // If context has integration, set referrer medium as integration anme
            if (context?.integration?.id) {
                try {
                    const integration = await this.models.Integration.findOne({id: context.integration.id});
                    attribution.referrerSource = `Integration: ${integration?.get('name')}`;
                } catch (error) {
                    // ignore error for integration not found
                }
            }
            return attribution;
        }
        return null;
    }

    /**
     *
     * @param {import('./history').UrlHistoryArray} historyArray
     * @returns {Promise<import('./attribution').Attribution>}
     */
    async getAttribution(historyArray) {
        let history = UrlHistory.create(historyArray);
        if (!this.isTrackingEnabled) {
            history = UrlHistory.create([]);
        }
        return await this.attributionBuilder.getAttribution(history);
    }

    /**
     * Add some parameters to a URL so that the frontend script can detect this and add the required records
     * in the URLHistory.
     * @param {URL} url instance that will get updated
     * @param {Object} newsletter The newsletter from which a link was clicked
     * @param {boolean} isExternal whether the url points to an external domain
     * @returns {URL}
     */
    addEmailSourceAttributionTracking(url, newsletter, isExternal) {
        // Create a deep copy
        url = new URL(url);
        if (!isExternal) {
            // For exteral sites, we use the site name instead of the newsletter name
            const name = slugify(newsletter.get('name'));
            // If newsletter name ends with newsletter, don't add it again
            const ref = name.endsWith('newsletter') ? name : `${name}-newsletter`;
            url.searchParams.append('ref', ref);
        } else {
            // Check blacklist domains
            const referrerDomain = url.hostname;
            if (blacklistedReferrerDomains.includes(referrerDomain)) {
                return url;
            }

            // For links to our site, we'll use the newsletter name as the referrer
            url.searchParams.append('ref', slugify(this.siteTitle));
        }
        return url;
    }

    /**
     * Add some parameters to a URL so that the frontend script can detect this and add the required records
     * in the URLHistory.
     * @param {URL} url instance that will get updated
     * @param {Object} post The post from which a link was clicked
     * @returns {URL}
     */
    addPostAttributionTracking(url, post) {
        // Create a deep copy
        url = new URL(url);

        // Post attribution
        url.searchParams.append('attribution_id', post.id);
        url.searchParams.append('attribution_type', 'post');
        return url;
    }

    /**
     * Returns the attribution resource for a given event model (MemberCreatedEvent / SubscriptionCreatedEvent), where the model has the required relations already loaded
     * You need to already load the 'postAttribution', 'userAttribution', and 'tagAttribution' relations
     * @param {Object} eventModel MemberCreatedEvent or SubscriptionCreatedEvent
     * @returns {import('./attribution').AttributionResource|null}
     */
    getEventAttribution(eventModel) {
        const _attribution = this.attributionBuilder.build({
            id: eventModel.get('attribution_id'),
            url: eventModel.get('attribution_url'),
            type: eventModel.get('attribution_type'),
            referrerSource: eventModel.get('referrer_source'),
            referrerMedium: eventModel.get('referrer_medium'),
            referrerUrl: eventModel.get('referrer_url')
        });

        if (_attribution.type && _attribution.type !== 'url') {
            // Find the right relation to use to fetch the resource
            const tryRelations = [
                eventModel.related('postAttribution'),
                eventModel.related('userAttribution'),
                eventModel.related('tagAttribution')
            ];
            for (const relation of tryRelations) {
                if (relation && relation.id) {
                    // We need to check the ID, because .related() always returs a model when eager loaded, even when the relation didn't exist
                    return _attribution.getResource(relation);
                }
            }
        }
        return _attribution.getResource(null);
    }

    /**
     * Returns the parsed attribution for a member creation event
     * @param {string} memberId
     * @returns {Promise<import('./attribution').AttributionResource|null>}
     */
    async getMemberCreatedAttribution(memberId) {
        const memberCreatedEvent = await this.models.MemberCreatedEvent.findOne({member_id: memberId}, {require: false, withRelated: []});
        if (!memberCreatedEvent) {
            return null;
        }
        const attribution = this.attributionBuilder.build({
            id: memberCreatedEvent.get('attribution_id'),
            url: memberCreatedEvent.get('attribution_url'),
            type: memberCreatedEvent.get('attribution_type'),
            referrerSource: memberCreatedEvent.get('referrer_source'),
            referrerMedium: memberCreatedEvent.get('referrer_medium'),
            referrerUrl: memberCreatedEvent.get('referrer_url')
        });
        return await attribution.fetchResource();
    }

    /**
     * Returns the last attribution for a given subscription ID
     * @param {string} subscriptionId
     * @returns {Promise<import('./attribution').AttributionResource|null>}
     */
    async getSubscriptionCreatedAttribution(subscriptionId) {
        const subscriptionCreatedEvent = await this.models.SubscriptionCreatedEvent.findOne({subscription_id: subscriptionId}, {require: false, withRelated: []});
        if (!subscriptionCreatedEvent) {
            return null;
        }
        const attribution = this.attributionBuilder.build({
            id: subscriptionCreatedEvent.get('attribution_id'),
            url: subscriptionCreatedEvent.get('attribution_url'),
            type: subscriptionCreatedEvent.get('attribution_type'),
            referrerSource: subscriptionCreatedEvent.get('referrer_source'),
            referrerMedium: subscriptionCreatedEvent.get('referrer_medium'),
            referrerUrl: subscriptionCreatedEvent.get('referrer_url')
        });
        return await attribution.fetchResource();
    }

    /**
     * Maps the framework context to source string
     * @param {Object} context instance of ghost framework context object
     * @returns {'import' | 'system' | 'api' | 'admin' | 'member'}
     * @private
     */
    _resolveContextSource(context) {
        let source;

        if (context.import || context.importer) {
            source = 'import';
        } else if (context.internal) {
            source = 'system';
        } else if (context.api_key) {
            source = 'api';
        } else if (context.user) {
            source = 'admin';
        } else {
            source = 'member';
        }

        return source;
    }
}

module.exports = MemberAttributionService;
