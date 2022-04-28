import Component from '@glimmer/component';
import fetch from 'fetch';
import {action} from '@ember/object';
import {task} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';
import {inject as service} from '@ember/service';

const API_URL = 'https://resources.ghost.io/resources';
const API_KEY = 'b30afc1721f5d8d021ec3450ef';
const RESOURCE_COUNT = 1;

export default class Resources extends Component {
    @service dashboardStats;
    @tracked loading = null;
    @tracked error = null;
    @tracked resources = null;
    @tracked resource = null;

    @action
    load() {
        this.loading = true;
        this.fetch.perform().then(() => {
            this.loading = false;
        }, (error) => {
            this.error = error;
            this.loading = false;
        });
    }

    @task
    *fetch() {
        const order = encodeURIComponent('published_at DESC');
        const key = encodeURIComponent(API_KEY);
        const limit = encodeURIComponent(RESOURCE_COUNT);
        let response = yield fetch(`${API_URL}/ghost/api/content/posts/?limit=${limit}&order=${order}&key=${key}&include=none`);
        if (!response.ok) {
            // eslint-disable-next-line
            console.error('Failed to fetch resources', {response});
            this.error = 'Failed to fetch';
            return;
        }

        let result = yield response.json();
        this.resources = result.posts || [];
        this.resource = this.resources[0]; // just get the first
    }

    get hasPaidTiers() {
        return this.dashboardStats.siteStatus?.hasPaidTiers;
    }

    get areNewslettersEnabled() {
        return this.dashboardStats.siteStatus?.newslettersEnabled;
    }

    get areMembersEnabled() {
        return this.dashboardStats.siteStatus?.membersEnabled;
    }

    get hasNothingEnabled() {
        return (!this.areMembersEnabled && !areNewslettersEnabled && !hasPaidTiers);
    }
}
