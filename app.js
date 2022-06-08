'use strict'

var port = process.env.PORT || 3000;
var request = require('request');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var express = require('express');
var app = express();
var QuickBooks = require('node-quickbooks');
var Tokens = require('csrf');
var csrf = new Tokens();

QuickBooks.setOauthVersion('2.0');

app.set('port', port);
app.set('views', 'views');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('brad'));
app.use(session({ resave: false, saveUninitialized: false, secret: 'smith' }));

app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

var consumerKey = 'ABo8bNwrVz9XdlDRod9ANVdr5MSTKh6dtpjX2CXNNsZ5BveP68';
var consumerSecret = '22R9vJ1To0hYTOxoClmR3BllcvQ4Dqsn9OkDnakB';
var qbo;

app.get('/', function (req, res) {
    res.redirect('/start');
});

app.get('/start', function (req, res) {
    res.render('intuit.ejs', { port: port, appCenter: QuickBooks.APP_CENTER_BASE });
});

function generateAntiForgery (session) {
    session.secret = csrf.secretSync();
    return csrf.create(session.secret);
}

app.get('/requestToken', function (req, res) {
    var redirecturl = QuickBooks.AUTHORIZATION_URL +
        '?client_id=' + consumerKey +
        '&redirect_uri=' + encodeURIComponent('http://localhost:3000/callback') +  //Make sure this path matches entry in application dashboard
        '&scope=com.intuit.quickbooks.accounting' +
        '&response_type=code' +
        '&state=' + generateAntiForgery(req.session);

    res.redirect(redirecturl);
});

app.get('/callback', function (req, res) {
    var auth = (new Buffer(consumerKey + ':' + consumerSecret).toString('base64'));

    var postBody = {
        url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + auth,
        },
        form: {
            grant_type: 'authorization_code',
            code: req.query.code,
            redirect_uri: 'http://localhost:3000/callback'  //Make sure this path matches entry in application dashboard
        }
    };

    request.post(postBody, function (e, r, data) {
        var accessToken = JSON.parse(r.body);

        qbo = new QuickBooks(consumerKey,
            consumerSecret,
            accessToken.access_token,
            false,
            req.query.realmId,
            true,
            true,
            4,
            '2.0',
            accessToken.refresh_token);

        qbo.createInvoice({
            "Line": [
                {
                    "DetailType": "SalesItemLineDetail",
                    "Amount": 100.0,
                    "SalesItemLineDetail": {
                        "ItemRef": {
                            "name": "Services",
                            "value": "1"
                        }
                    }
                }
            ],
            "CustomerRef": {
                "value": "1"
            }
        }, function (response) {
            console.log("[create invoice]: ", response);
        })

    });

    res.send('<!DOCTYPE html><html lang="en"><head></head><body><script>window.opener.location.reload(); window.close();</script></body></html>');
});

