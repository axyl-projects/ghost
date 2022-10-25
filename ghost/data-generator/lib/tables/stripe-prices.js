const {faker} = require('@faker-js/faker');
const TableImporter = require('./base');
const {blogStartDate} = require('../utils/blog-info');

class StripePricesImporter extends TableImporter {
    constructor(knex, {products}) {
        super('stripe_prices', knex);
        this.products = products;
    }

    setImportOptions({model}) {
        this.model = model;

        this.count = 0;
    }

    generate() {
        const sixWeeksLater = new Date(blogStartDate);
        sixWeeksLater.setDate(sixWeeksLater.getDate() + (7 * 6));

        const count = this.count;
        this.count = this.count + 1;

        const relatedProduct = this.products.find(product => product.id === this.model.product_id);

        if (count === 1 && relatedProduct.monthly_price === null) {
            // Only single complimentary price (yearly)
            return null;
        }

        const billingCycle = {
            nickname: 'Monthly',
            interval: 'monthly',
            type: 'recurring',
            currency: 'usd',
            amount: relatedProduct.monthly_price
        };
        if (count === 1) {
            Object.assign(billingCycle, {
                nickname: 'Yearly',
                interval: 'yearly',
                amount: relatedProduct.yearly_price
            });
        } else if (relatedProduct.monthly_price === null) {
            Object.assign(billingCycle, {
                nickname: 'Complimentary',
                interval: 'yearly',
                amount: 0
            });
        }

        return Object.assign({}, {
            id: faker.database.mongodbObjectId(),
            stripe_price_id: faker.datatype.hexadecimal({length: 64}),
            stripe_product_id: this.model.stripe_product_id,
            active: true,
            created_at: faker.date.between(blogStartDate, sixWeeksLater)
        }, billingCycle);
    }
}

module.exports = StripePricesImporter;
