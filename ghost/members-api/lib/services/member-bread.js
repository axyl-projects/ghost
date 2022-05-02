const errors = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const tpl = require('@tryghost/tpl');
const moment = require('moment');

const messages = {
    stripeNotConnected: 'Missing Stripe connection.',
    memberAlreadyExists: 'Member already exists.'
};

/**
 * @typedef {object} ILabsService
 * @prop {(key: string) => boolean} isSet
 */

/**
 * @typedef {object} IEmailService
 * @prop {(data: {email: string, requestedType: string}) => Promise<any>} sendEmailWithMagicLink
 */

/**
 * @typedef {object} IStripeService
 * @prop {boolean} configured
 */

/**
 * @typedef {import('@tryghost/members-offers/lib/application/OfferMapper').OfferDTO} OfferDTO
 */

module.exports = class MemberBREADService {
    /**
     * @param {object} deps
     * @param {import('../repositories/member')} deps.memberRepository
     * @param {import('@tryghost/members-offers/lib/application/OffersAPI')} deps.offersAPI
     * @param {ILabsService} deps.labsService
     * @param {IEmailService} deps.emailService
     * @param {IStripeService} deps.stripeService
     */
    constructor({memberRepository, labsService, emailService, stripeService, offersAPI}) {
        this.offersAPI = offersAPI;
        /** @private */
        this.memberRepository = memberRepository;
        /** @private */
        this.labsService = labsService;
        /** @private */
        this.emailService = emailService;
        /** @private */
        this.stripeService = stripeService;
    }

    /**
     * @private
     * Adds missing complimentary subscriptions to a member and makes sure the tier of all subscriptions is set correctly.
     */
    attachSubscriptionsToMember(member) {
        if (!member.products || !Array.isArray(member.products)) {
            return member;
        }

        const subscriptionProducts = (member.subscriptions || [])
            .filter(sub => sub.status !== 'canceled')
            .map(sub => sub.price.product.product_id);

        for (const product of member.products) {
            if (!subscriptionProducts.includes(product.id)) {
                const productAddEvent = member.productEvents.find(event => event.product_id === product.id);
                let startDate;
                if (!productAddEvent || productAddEvent.action !== 'added') {
                    startDate = moment();
                } else {
                    startDate = moment(productAddEvent.created_at);
                }
                member.subscriptions.push({
                    id: '',
                    tier: product,
                    customer: {
                        id: '',
                        name: member.name,
                        email: member.email
                    },
                    plan: {
                        id: '',
                        nickname: 'Complimentary',
                        interval: 'year',
                        currency: 'USD',
                        amount: 0
                    },
                    status: 'active',
                    start_date: startDate,
                    default_payment_card_last4: '****',
                    cancel_at_period_end: false,
                    cancellation_reason: null,
                    current_period_end: moment(startDate).add(1, 'year'),
                    price: {
                        id: '',
                        price_id: '',
                        nickname: 'Complimentary',
                        amount: 0,
                        interval: 'year',
                        type: 'recurring',
                        currency: 'USD',
                        product: {
                            id: '',
                            product_id: product.id
                        }
                    }
                });
            }
        }

        for (const subscription of member.subscriptions) {
            if (!subscription.tier) {
                subscription.tier = member.products.find(product => product.id === subscription.price.product.product_id);
            }
        }
    }

    /**
     * @private Builds a map between subscriptions and their offer representation (from OfferMapper)
     * @returns {Promise<Map<string, OfferDTO>>}
     */
    async fetchSubscriptionOffers(subscriptions) {
        const fetchedOffers = new Map();
        const subscriptionOffers = new Map();

        try {
            for (const subscriptionModel of subscriptions) {
                const offerId = subscriptionModel.get('offer_id');
    
                if (!offerId) {
                    continue;
                }
                
                let offer = fetchedOffers.get(offerId);
                if (!offer) {
                    offer = await this.offersAPI.getOffer({id: offerId});
                    fetchedOffers.set(offerId, offer);
                }
    
                subscriptionOffers.set(subscriptionModel.get('subscription_id'), offer);
            }
        } catch (e) {
            logging.error(`Failed to load offers for subscriptions - ${subscriptions.map(s => s.id).join(', ')}.`);
            logging.error(e);
        }
        
        return subscriptionOffers;
    }

    /**
     * @private
     * @param {Object} member JSON serialized member
     * @param {Map<string, OfferDTO>} subscriptionOffers result from fetchSubscriptionOffers
     */
    attachOffersToSubscriptions(member, subscriptionOffers) {
        member.subscriptions = member.subscriptions.map((subscription) => {
            const offer = subscriptionOffers.get(subscription.id);
            if (offer) {
                subscription.offer = offer;
            } else {
                subscription.offer = null;
            }
            return subscription;
        });
    }

    async read(data, options = {}) {
        const defaultWithRelated = [
            'labels',
            'stripeSubscriptions',
            'stripeSubscriptions.customer',
            'stripeSubscriptions.stripePrice',
            'stripeSubscriptions.stripePrice.stripeProduct',
            'stripeSubscriptions.stripePrice.stripeProduct.product',
            'products',
            'newsletters'
        ];

        const withRelated = new Set((options.withRelated || []).concat(defaultWithRelated));

        if (!withRelated.has('productEvents')) {
            withRelated.add('productEvents');
        }

        if (withRelated.has('email_recipients')) {
            withRelated.add('email_recipients.email');
        }

        const model = await this.memberRepository.get(data, {
            ...options,
            withRelated: Array.from(withRelated)
        });

        if (!model) {
            return null;
        }

        const member = model.toJSON(options);

        member.subscriptions = member.subscriptions.filter(sub => !!sub.price);
        this.attachSubscriptionsToMember(member);
        this.attachOffersToSubscriptions(member, await this.fetchSubscriptionOffers(model.related('stripeSubscriptions')));

        return member;
    }

    async add(data, options) {
        if (!this.labsService.isSet('multipleProducts')) {
            delete data.products;
        }

        if (!this.labsService.isSet('multipleNewsletters')) {
            delete data.newsletters;
        }

        if (!this.stripeService.configured && (data.comped || data.stripe_customer_id)) {
            const property = data.comped ? 'comped' : 'stripe_customer_id';
            throw new errors.ValidationError({
                message: tpl(messages.stripeNotConnected),
                context: 'Attempting to import members with Stripe data when there is no Stripe account connected.',
                help: 'You need to connect to Stripe to import Stripe customers. ',
                property
            });
        }

        let model;

        try {
            model = await this.memberRepository.create(data, options);
        } catch (error) {
            if (error.code && error.message.toLowerCase().indexOf('unique') !== -1) {
                throw new errors.ValidationError({
                    message: tpl(messages.memberAlreadyExists),
                    context: 'Attempting to add member with existing email address'
                });
            }
            throw error;
        }

        const sharedOptions = options.transacting ? {
            transacting: options.transacting
        } : {};

        try {
            if (data.stripe_customer_id) {
                await this.memberRepository.linkStripeCustomer({
                    customer_id: data.stripe_customer_id,
                    member_id: model.id
                }, sharedOptions);
            }
        } catch (error) {
            const isStripeLinkingError = error.message && (error.message.match(/customer|plan|subscription/g));
            if (isStripeLinkingError) {
                if (error.message.indexOf('customer') && error.code === 'resource_missing') {
                    error.message = `Member not imported. ${error.message}`;
                    error.context = 'Missing Stripe Customer';
                    error.help = 'Make sure you\'re connected to the correct Stripe Account';
                }

                await this.memberRepository.destroy({
                    id: model.id
                }, options);
            }
            throw error;
        }

        if (!this.labsService.isSet('multipleProducts')) {
            if (data.comped) {
                await this.memberRepository.setComplimentarySubscription(model, sharedOptions);
            }
        }

        if (options.send_email) {
            await this.emailService.sendEmailWithMagicLink({
                email: model.get('email'), requestedType: options.email_type
            });
        }

        return this.read({id: model.id}, options);
    }

    async edit(data, options) {
        if (!this.labsService.isSet('multipleProducts')) {
            delete data.products;
        }

        if (!this.labsService.isSet('multipleNewsletters')) {
            delete data.newsletters;
        }

        delete data.last_seen_at;

        let model;

        try {
            model = await this.memberRepository.update(data, options);
        } catch (error) {
            if (error.code && error.message.toLowerCase().indexOf('unique') !== -1) {
                throw new errors.ValidationError({
                    message: tpl(messages.memberAlreadyExists),
                    context: 'Attempting to edit member with existing email address'
                });
            }

            throw error;
        }

        const hasCompedSubscription = !!model.related('stripeSubscriptions').find((sub) => {
            return sub.get('plan_nickname') === 'Complimentary' && sub.get('status') === 'active';
        });

        if (!this.labsService.isSet('multipleProducts')) {
            if (typeof data.comped === 'boolean') {
                if (data.comped && !hasCompedSubscription) {
                    await this.memberRepository.setComplimentarySubscription(model);
                } else if (!data.comped && hasCompedSubscription) {
                    await this.memberRepository.cancelComplimentarySubscription(model);
                }
            }
        }

        return this.read({id: model.id}, options);
    }

    async browse(options) {
        const defaultWithRelated = [
            'labels',
            'stripeSubscriptions',
            'stripeSubscriptions.customer',
            'stripeSubscriptions.stripePrice',
            'stripeSubscriptions.stripePrice.stripeProduct',
            'stripeSubscriptions.stripePrice.stripeProduct.product',
            'products',
            'newsletters'
        ];

        const originalWithRelated = options.withRelated || [];

        const withRelated = new Set((originalWithRelated).concat(defaultWithRelated));

        if (!withRelated.has('productEvents')) {
            withRelated.add('productEvents');
        }

        if (withRelated.has('email_recipients')) {
            withRelated.add('email_recipients.email');
        }

        const page = await this.memberRepository.list({
            ...options,
            withRelated: Array.from(withRelated)
        });

        if (!page) {
            return null;
        }

        const subscriptions = page.data.flatMap(model => model.related('stripeSubscriptions').slice());
        const offerMap = await this.fetchSubscriptionOffers(subscriptions);

        const members = page.data.map(model => model.toJSON(options));

        const data = members.map((member) => {
            member.subscriptions = member.subscriptions.filter(sub => !!sub.price);
            this.attachSubscriptionsToMember(member);
            this.attachOffersToSubscriptions(member, offerMap);
            if (!originalWithRelated.includes('products')) {
                delete member.products;
            }
            return member;
        });

        return {
            data,
            meta: page.meta
        };
    }
};
