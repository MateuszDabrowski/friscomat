/* eslint-disable no-continue */
const axios = require('axios');
const puppeteer = require('puppeteer');
const { IncomingWebhook } = require('@slack/webhook');
require('dotenv/config.js');

const headless =
    process.env.NODE_ENV === 'development' ? { headless: false, slowMo: 20 } : { args: ['--no-sandbox'], slowMo: 20 };

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
            await page.waitForSelector('.header-user');
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
            if (deliveryDate.match(/\w/)) {
                break;
            }
        } catch (error) {
            continue;
        }
    }
    if (!deliveryDate.match(/\w/)) {
        console.log(`deliveryDate value: ${deliveryDate}`);
        await browser.close();
        return false;
    }
    console.log(deliveryDate);

    // Calculate delivery Epoch
    let deliveryDay = deliveryDate.split(' ')[0];
    let deliveryMonth = deliveryDate.split(' ')[1];
    let deliveryDaysLeft = 0;

    // Check if delivery date is tomorrow
    if (deliveryDate.includes('jutro')) {
        deliveryDay = 'tomorrow!';
        deliveryMonth = '';
        deliveryDaysLeft = 1;
    } else {
        deliveryDay = deliveryDay.length === 1 ? `0${deliveryDay}` : deliveryDay;
        deliveryMonth = months[deliveryMonth];

        // Calculate number of days till delivery date
        const deliveryEpoch = Date.parse(`${deliveryMonth} ${deliveryDay}, 2020`);
        deliveryDaysLeft = Math.round((deliveryEpoch - Date.now()) / days);

        // if delivery date not within next week, finish
        if (deliveryDaysLeft > deliveryWithinDays) {
            console.log(`${deliveryDaysLeft} days till nearest available delivery date`);
            await browser.close();
            return false;
        }
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
    try {
        await page.waitForSelector('.reservation-selector_tabs-content');
        await page.click('.reservation-selector_tabs-content > .button');
    } catch (error) {
        console.log('Not able to create reservation');
    }

    // Get all available hours
    let deliveryHours = [];
    for (let i = 0; i < 3; i += 1) {
        await page.waitFor(i * 1000);
        try {
            deliveryHours = await page.$$eval('span.available > .hours', (timeslots) =>
                timeslots.map((timeframe) => timeframe.textContent)
            );
        } catch (error) {
            continue;
        }
    }
    console.log(deliveryHours);

    await slack.send({
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `:truck: *<https://www.frisco.pl|Frisco> delivery available: ${deliveryDay} ${deliveryMonth}*`,
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

    await axios.post(process.env.GOOGLE_CHAT_WEBHOOK_URL, {
        cards: [
            {
                header: {
                    title: `Frisco delivery available on ${deliveryDay} ${deliveryMonth}`,
                    subtitle: `${deliveryHours.length} timeframes to choose from`,
                },
                sections: [
                    {
                        widgets: [
                            {
                                keyValue: {
                                    icon: 'clock',
                                    topLabel: 'Available timeframes',
                                    content: `${deliveryHours.join('\n')}`,
                                },
                            },
                        ],
                    },
                    {
                        widgets: [
                            {
                                buttons: [
                                    {
                                        textButton: {
                                            text: 'Go to Frisco',
                                            onClick: {
                                                openLink: {
                                                    url: 'https://www.frisco.pl',
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    });

    console.log('Scrape End');

    await browser.close();
    return true;
})();
