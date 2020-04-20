/* eslint-disable no-continue */
const puppeteer = require('puppeteer');
require('dotenv/config.js');

const headless = process.env.NODE_ENV === 'development' ? { headless: false } : undefined;

(async () => {
    const browser = await puppeteer.launch(headless);
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    // Go to Frisco page
    await page.goto('https://www.frisco.pl', { waitUntil: 'networkidle2' });
    console.log('On Frisco page');

    // Close popups if opened
    if (await page.$('a.close')) {
        await page.$$eval('a.close', (closeButtons) => closeButtons.map((button) => button.click()));
    }

    // Close cookie popup if opened
    if (await page.$('.mini-notification_close')) {
        await page.click('.mini-notification_close');
    }

    console.log('Popups closed');
    // Check login status
    const [notLogged] = await page.$x("//a[contains(., 'Zaloguj się')]");
    if (notLogged) {
        console.log('Logging in');
        // Open login menu
        await notLogged.click();

        for (let i = 0; i < 3; i += 1) {
            await page.waitFor(i * 1000);
            // Pass in login details
            try {
                await page.type('input[name="username"]', process.env.FRISCO_LOGIN);
                await page.type('input[name="password"]', process.env.FRISCO_PASSWORD);
            } catch (error) {
                continue;
            }

            // Log in to Frisco
            await page.click('input.login[type="submit"]');

            // Check if login was successful
            await page.waitForSelector('.header_user-menu');
            if (!notLogged) {
                break;
            }
        }
    }
    console.log('Logged in');

    // Check reservation date
    let deliveryDate = '';
    for (let i = 0; i < 3; i += 1) {
        await page.waitFor(i * 1000);
        try {
            deliveryDate = await page.$eval('div.date', (element) => element.textContent);
            if (deliveryDate) {
                break;
            }
        } catch (error) {
            continue;
        }
    }
    console.log(deliveryDate);

    // TODO: Logic for assessing interesting delivery date and looping if it is not interesting

    // Open reservation panel
    for (let i = 0; i < 10; i += 1) {
        await page.click('div.date');
        await page.waitFor(i * 1000);
        try {
            const reservations = await page.$eval(
                '.reservation-selector_header-title',
                (element) => element.textContent
            );
            if (reservations.includes('rezerwacje')) {
                break;
            }
        } catch (error) {
            continue;
        }
    }

    // Create new reservation
    await page.waitForSelector('.reservation-selector_tabs-content');
    await page.click('.reservation-selector_tabs-content > .button');

    // Get all available hours
    await page.waitForSelector('span.available');
    const deliveryHours = await page.$$eval('span.available > .hours', (timeslots) =>
        timeslots.map((timeframe) => timeframe.textContent)
    );
    console.log(deliveryHours);

    console.log('End');

    // await browser.close();
})();

// TODO: Slack integration
