import Component from '@glimmer/component';
import moment from 'moment-timezone';
import {action} from '@ember/object';
import {didCancel, task} from 'ember-concurrency';
import {inject as service} from '@ember/service';
import {tracked} from '@glimmer/tracking';
export default class Debug extends Component {
    @service ajax;
    @service ghostPaths;
    @service settings;
    @service membersUtils;
    @service utils;
    @service feature;

    @tracked emailBatches = null;
    @tracked recipientFailures = null;

    get post() {
        return this.args.post;
    }

    get emailSettings() {
        return {
            statusClass: this.post.email?.status,
            status: this.getStatusLabel(this.post.email?.status),
            recipientFilter: this.post.email?.recipientFilter,
            createdAt: this.post.email.createdAtUTC ? moment(this.post.email.createdAtUTC).format('DD MMM, YYYY, HH:mm:ss') : '',
            submittedAt: this.post.email.submittedAtUTC ? moment(this.post.email.submittedAtUTC).format('DD MMM, YYYY, HH:mm:ss') : '',
            emailsSent: this.post.email?.emailCount,
            emailsDelivered: this.post.email?.deliveredCount,
            emailsFailed: this.post.email?.failedCount,
            trackOpens: this.post.email?.trackOpens,
            trackClicks: this.post.email?.trackClicks,
            feedbackEnabled: this.post.email?.feedbackEnabled
        };
    }

    get tabTotals() {
        return {
            temporaryFailures: this.temporaryFailureData?.length || 0,
            permanentFailures: this.permanentFailureData?.length || 0,
            erroredBatches: this.emailBatchesData?.filter((batch) => {
                return batch.statusClass === 'failed';
            }).length || 0
        };
    }

    get emailBatchesData() {
        return this.emailBatches?.map((batch) => {
            return {
                id: batch.id,
                status: this.getStatusLabel(batch.status),
                statusClass: batch.status,
                createdAt: batch.created_at ? moment(batch.created_at).format('DD MMM, YYYY, HH:mm:ss') : '',
                segment: batch.member_segment || '',
                providerId: batch.provider_id || null,
                errorMessage: batch.error_message || '',
                errorStatusCode: batch.error_status_code || '',
                recipientCount: batch.count?.recipients || 0
            };
        });
    }

    get temporaryFailureData() {
        return this.recipientFailures?.filter((failure) => {
            return failure.severity === 'temporary';
        }).map((failure) => {
            return {
                id: failure.id,
                code: failure.code,
                enhancedCode: failure.enhanced_code,
                message: failure.message,
                member: {
                    name: failure.member?.name || '',
                    email: failure.member?.email || '',
                    initials: this.getInitials(failure.member?.name)
                }
            };
        });
    }

    get permanentFailureData() {
        return this.recipientFailures?.filter((failure) => {
            return failure.severity === 'permanent';
        }).map((failure) => {
            return {
                id: failure.id,
                code: failure.code,
                enhancedCode: failure.enhanced_code,
                message: failure.message,
                member: {
                    name: failure.member?.name || '',
                    email: failure.member?.email || '',
                    initials: this.getInitials(failure.member?.name)
                }
            };
        });
    }

    getInitials(name) {
        if (!name) {
            return 'U';
        }
        let names = name.split(' ');
        let intials = names.length > 1 ? [names[0][0], names[names.length - 1][0]] : [names[0][0]];
        return intials.join('').toUpperCase();
    }

    getStatusLabel(status) {
        if (status === 'submitted') {
            return 'Submitted';
        } else if (status === 'submitting') {
            return 'Submitting';
        } else if (status === 'pending') {
            return 'Pending';
        } else if (status === 'failed') {
            return 'Failed';
        }
        return status;
    }

    @action
    loadData() {
        this.fetchEmailBatches();
        this.fetchRecipientFailures();
    }

    async fetchEmailBatches() {
        try {
            if (this._fetchEmailBatches.isRunning) {
                return this._fetchEmailBatches.last;
            }
            return this._fetchEmailBatches.perform();
        } catch (e) {
            if (!didCancel(e)) {
                // re-throw the non-cancelation error
                throw e;
            }
        }
    }

    @task
    *_fetchEmailBatches() {
        const data = {
            include: 'count.recipients'
        };

        let statsUrl = this.ghostPaths.url.api(`emails/${this.post.email.id}/batches`);
        let result = yield this.ajax.request(statsUrl, {data});
        this.emailBatches = result.batches;
    }

    async fetchRecipientFailures() {
        try {
            if (this._fetchRecipientFailures.isRunning) {
                return this._fetchRecipientFailures.last;
            }
            return this._fetchRecipientFailures.perform();
        } catch (e) {
            if (!didCancel(e)) {
                // re-throw the non-cancelation error
                throw e;
            }
        }
    }

    @task
    *_fetchRecipientFailures() {
        const data = {
            include: 'member,email_recipient'
        };
        let statsUrl = this.ghostPaths.url.api(`/emails/${this.post.email.id}/recipient-failures`);
        let result = yield this.ajax.request(statsUrl, {data});
        this.recipientFailures = result.failures;
    }
}
