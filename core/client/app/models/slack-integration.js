import Ember from 'ember';
import ValidationEngine from 'ghost/mixins/validation-engine';

export default Ember.Object.extend(ValidationEngine, {
    // values entered here will act as defaults
    isActive: false,
    url: '/',
    icon: ':ghost:',
    username: 'Ghost',

    validationType: 'slackIntegration'
});
