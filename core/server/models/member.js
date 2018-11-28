const ghostBookshelf = require('./base');

const Member = ghostBookshelf.Model.extend({
    tableName: 'members',

    relationships: ['tokens', 'password'],
    relationshipBelongsTo: {
        tokens: 'credentials',
        password: 'credentials'
    },

    emitChange: function emitChange(event, options) {
        const eventToTrigger = 'member' + '.' + event;
        ghostBookshelf.Model.prototype.emitChange.bind(this)(this, eventToTrigger, options);
    },

    onCreated: function onCreated(model, attrs, options) {
        model.emitChange('added', options);
    },

    onUpdated: function onUpdated(model, attrs, options) {
        model.emitChange('edited', options);
    },

    onDestroyed: function onDestroyed(model, options) {
        model.emitChange('deleted', options);
    },

    toJSON: function toJSON(unfilteredOptions) {
        var options = Member.filterOptions(unfilteredOptions, 'toJSON'),
            attrs = ghostBookshelf.Model.prototype.toJSON.call(this, options);

        // remove password hash and tokens for security reasons
        delete attrs.password;
        delete attrs.tokens;

        return attrs;
    },

    password: function password() {
        return this.belongsToMany('Credential', 'members_passwords', 'member_id', 'credential_id');
    },

    tokens: function tokens() {
        return this.belongsToMany('Credential', 'members_tokens', 'member_id', 'credential_id');
    },

    permittedAttributes(...args) {
        return ghostBookshelf.Model.prototype.permittedAttributes.apply(this, args).concat(this.relationships);
    }
});

const Members = ghostBookshelf.Collection.extend({
    model: Member
});

module.exports = {
    Member: ghostBookshelf.model('Member', Member),
    Members: ghostBookshelf.collection('Members', Members)
};
