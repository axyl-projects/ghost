import {E2E_PORT} from '../../playwright.config';
import {Page} from '@playwright/test';

const MOCKED_SITE_URL = 'https://localhost:1234';

type LastApiRequest = {
    body: null | any
};

export async function initialize({page, path, ...options}: {page: Page, path?: string; title?: string, description?: string, logo?: string, backgroundColor?: string, buttonColor?: string, site?: string, 'label-1'?: string, 'label-2'?: string}) {
    const sitePath = `${MOCKED_SITE_URL}${path ?? ''}`;
    await page.route(sitePath, async (route) => {
        await route.fulfill({
            status: 200,
            body: '<html><body></body></html>'
        });
    });

    const url = `http://localhost:${E2E_PORT}/signup-form.min.js`;
    await page.setViewportSize({width: 1000, height: 1000});

    await page.goto(sitePath);
    const lastApiRequest = await mockApi({page});

    if (!options.site) {
        options.site = MOCKED_SITE_URL;
    }

    await page.evaluate((data) => {
        const scriptTag = document.createElement('script');
        scriptTag.src = data.url;

        for (const option of Object.keys(data.options)) {
            scriptTag.dataset[option] = data.options[option];
        }
        document.body.appendChild(scriptTag);
    }, {url, options});

    await page.waitForSelector('iframe');

    return {
        frame: page.frameLocator('iframe'),
        lastApiRequest
    };
}

export async function mockApi({page}: {page: any}) {
    const lastApiRequest: LastApiRequest = {
        body: null
    };

    await page.route(`${MOCKED_SITE_URL}/members/api/send-magic-link/`, async (route) => {
        const requestBody = JSON.parse(route.request().postData());
        lastApiRequest.body = requestBody;

        await route.fulfill({
            status: 200,
            body: 'ok'
        });
    });

    await page.route(`${MOCKED_SITE_URL}/invalid/members/api/send-magic-link/`, async (route) => {
        await route.abort('addressunreachable');
    });

    return lastApiRequest;
}
