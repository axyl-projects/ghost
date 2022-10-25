const TableImporter = require('./base');
const {faker} = require('@faker-js/faker');
const {slugify} = require('@tryghost/string');
const {blogStartDate} = require('../utils/blog-info');

class ProductsImporter extends TableImporter {
    constructor(knex) {
        super('products', knex);
    }

    setImportOptions() {
        this.names = ['Free Preview', 'Bronze', 'Silver', 'Gold'];
        this.count = 0;
    }

    generate() {
        const name = this.names.shift();
        const count = this.count;
        this.count = this.count + 1;
        const sixMonthsLater = new Date(blogStartDate);
        sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
        const tierInfo = {
            type: 'free',
            description: 'A free sample of content'
        };
        if (count !== 0) {
            Object.assign(tierInfo, {
                type: 'paid',
                description: `${name} star member`,
                currency: 'usd',
                monthly_price: count * 500,
                yearly_price: count * 5000
            });
        }
        return Object.assign({}, {
            id: faker.database.mongodbObjectId(),
            name: name,
            slug: `${slugify(name)}-${faker.random.numeric(3)}`,
            visibility: 'public',
            created_at: faker.date.between(blogStartDate, sixMonthsLater)
        }, tierInfo);
    }
}

module.exports = ProductsImporter;
