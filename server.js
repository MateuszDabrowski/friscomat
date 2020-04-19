/* eslint-disable no-continue */
const puppeteer = require('puppeteer');
const config = require('dotenv/config.js');

const headless = process.env.NODE_ENV === 'development' ? { headless: false } : null;

(async () => {
    const browser = await puppeteer.launch(headless);
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();

    // Go to Frisco page
    await page.goto('https://www.frisco.pl', { waitUntil: 'networkidle2' });

    // Close main popup if opened
    if (await page.$('.image-popups')) {
        await page.click('.image-popups > div > div > .close');
    }
    // Close cookie popup if opened
    if (await page.$('.mini-notification_close')) {
        await page.click('.mini-notification_close');
    }

    // Open login menu
    await page.click('.login > div > .cta');

    for (let i = 0; i < 10; i += 1) {
        await page.waitFor(i * 1000);
        // Pass in login details
        try {
            await page.waitForSelector('.form-input_email > div > input');
            await page.type('.popup_login-inputs-wrapper > .form-input_email > div > input', process.env.FRISCO_LOGIN);
            await page.type(
                '.popup_login-inputs-wrapper > .form-input_password > div > input',
                process.env.FRISCO_PASSWORD
            );
        } catch (error) {
            continue;
        }

        // Log in to Frisco
        await page.click('.popup_box-buttons > input');

        // Check if login was successful
        await page.waitForSelector('.header_user-menu');
        const login = await page.$eval('.header_user-menu', (element) => element.textContent);
        if (!login.includes('Zaloguj')) {
            break;
        }
    }

    // Check reservation date
    for (let i = 0; i < 10; i += 1) {
        await page.waitFor(i * 1000);
        try {
            const deliveryDate = await page.$eval(
                '.header_delivery-inner > div > .date',
                (element) => element.textContent
            );
            console.log(deliveryDate);
            if (deliveryDate) {
                break;
            }
        } catch (error) {
            continue;
        }
    }

    // TODO: Logic for assessing interesting delivery date and looping if it is not interesting

    // Open reservation panel
    for (let i = 0; i < 10; i += 1) {
        await page.click('.header_delivery-inner > div > .subline');
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

    // TODO: Logic for choosing the interesting timeframe for delivery

    // await browser.close();
})();

// TODO: Notification on sucess
