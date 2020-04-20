/* eslint-disable no-continue */
const puppeteer = require('puppeteer');
const { IncomingWebhook } = require('@slack/webhook');
require('dotenv/config.js');

const headless = process.env.NODE_ENV === 'development' ? { headless: false } : undefined;

const months = {
    sty: 'January',
    lut: 'February',
    mar: 'March',
    kwi: 'April',
    maj: 'May',
    cze: 'June',
    lip: 'July',
    sie: 'August',
    wrz: 'September',
    paz: 'October',
    lis: 'November',
    gru: 'December',
};
const minutes = 1000 * 60;
const hours = minutes * 60;
const days = hours * 24;

const deliveryWithinDays = 7;

const webhookUrl = process.env.SLACK_WEBHOOK_URL;
const slack = new IncomingWebhook(webhookUrl);

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

    // Calculate delivery Epoch
    let deliveryDay = deliveryDate.split(' ')[0];
    deliveryDay = deliveryDay.length === 1 ? `0${deliveryDay}` : deliveryDay;
    let deliveryMonth = deliveryDate.split(' ')[1];
    deliveryMonth = months[deliveryMonth];
    const deliveryEpoch = Date.parse(`${deliveryMonth} ${deliveryDay}, 2020`);

    // Calculate number of days till delivery date
    const deliveryDaysLeft = Math.round((deliveryEpoch - Date.now()) / days);

    // if delivery date not within next week, finish
    if (deliveryDaysLeft > deliveryWithinDays) {
        console.log(`${deliveryDaysLeft} days till nearest available delivery date`);
        await browser.close();
        return false;
    }

    // Open reservation panel
    for (let i = 0; i < 3; i += 1) {
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
    await page.waitFor(1000);
    const deliveryHours = await page.$$eval('span.available > .hours', (timeslots) =>
        timeslots.map((timeframe) => timeframe.textContent)
    );
    console.log(deliveryHours);

    await slack.send({
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `:truck: * <https://www.frisco.pl|Frisco> delivery available on ${deliveryDay} ${deliveryMonth}*`,
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `:clock9: ${deliveryHours.length} timeframes to choose from:`,
                },
            },
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `${deliveryHours.join('\t|\t')}`,
                },
            },
        ],
    });

    console.log('Scrape End');

    await browser.close();
    return true;
})();
