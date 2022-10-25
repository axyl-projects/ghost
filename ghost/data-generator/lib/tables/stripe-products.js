const {faker} = require('@faker-js/faker');
const TableImporter = require('./base');
const {blogStartDate} = require('../utils/blog-info');

class StripeProductsImporter extends TableImporter {
    constructor(knex) {
        super('stripe_products', knex);
    }

    setImportOptions({model}) {
        this.model = model;
    }

    generate() {
        const sixWeeksLater = new Date(blogStartDate);
        sixWeeksLater.setDate(sixWeeksLater.getDate() + (7 * 6));
        return {
            id: faker.database.mongodbObjectId(),
            product_id: this.model.id,
            stripe_product_id: faker.datatype.hexadecimal({
                length: 64
            }),
            created_at: faker.date.between(blogStartDate, sixWeeksLater)
        };
    }
}

module.exports = StripeProductsImporter;
