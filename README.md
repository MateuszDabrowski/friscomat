# Friscomat

Automatically checks the nearest available delivery date from Frisco shop and - if it is within the next 7 days - pushes notification to a slack channel

---

## .env

Structure of the .env file

``` env
NODE_ENV=development
FRISCO_LOGIN=loginToFriscoShop
FRISCO_PASSWORD=PasswordToFriscoShop
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/webhookUrlProvidedBySlackAPI
```

Be sure to swap them with your own data.

## Heroku

The script can be automated using free Heroku account.

To host the script on Heroku, you will need to:

1. Add content of the .env file as Config Vars (replace NODE_ENV value to production)
2. Add Puppeteer buildpack to Heroku (`https://github.com/jontewks/puppeteer-heroku-buildpack`)
3. Add Heroku Sheduler Add-on and configure it ([Heroku DevCenter User Guide](https://devcenter.heroku.com/articles/scheduler))
