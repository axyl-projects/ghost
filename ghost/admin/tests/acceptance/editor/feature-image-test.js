import loginAsRole from '../../helpers/login-as-role';
import {click, currentURL, find} from '@ember/test-helpers';
import {expect} from 'chai';
import {setupApplicationTest} from 'ember-mocha';
import {setupMirage} from 'ember-cli-mirage/test-support';
import {visit} from '../../helpers/visit';

describe('Acceptance: Feature Image', function () {
    let hooks = setupApplicationTest();
    setupMirage(hooks);

    beforeEach(async function () {
        this.server.loadFixtures();
        await loginAsRole('Administrator', this.server);
    });

    it('can display feature image with caption', async function () {
        const post = this.server.create('post', {status: 'published', featureImage: 'https://static.ghost.org/v4.0.0/images/feature-image.jpg', featureImageCaption: '<span style="white-space: pre-wrap;">Hello dogggos</span>'});
        await visit(`/editor/post/${post.id}`);
        expect(find('.gh-editor-feature-image img').src).to.equal('https://static.ghost.org/v4.0.0/images/feature-image.jpg');
        expect(find('.gh-editor-feature-image-caption').textContent).to.contain('Hello dogggos');
    });

    it('can delete a post', async function () {
        const post = this.server.create('post', {status: 'published'});
        await visit(`/editor/post/${post.id}`);

        await click('[data-test-psm-trigger]');
        await click('[data-test-button="delete-post"]');

        await click('[data-test-button="delete-post-confirm"]');

        expect(currentURL()).to.equal('/posts');
    });

    it('does not attempt to save if already deleted', async function () {
        const post = this.server.create('post', {status: 'published', featureImage: 'https://static.ghost.org/v4.0.0/images/feature-image.jpg', featureImageCaption: '<span style="white-space: pre-wrap;">Hello dogggos</span>'});
        await visit(`/editor/post/${post.id}`);

        // destroy post

        await post.destroy();

        await click('[data-test-psm-trigger]');
        await click('[data-test-button="delete-post"]');

        await click('[data-test-button="delete-post-confirm"]');

        await this.pauseTest();

        expect(currentURL()).to.equal('/posts');
    });
});