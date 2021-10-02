require('dotenv').config();
// import express from 'express';
// import sprightly from 'sprightly';
const sprightly = require("sprightly");
const axios = require('axios');
const { query } = require('express');
const express = require('express');
const path = require('path');
const app = express();
const cookieParser = require("cookie-parser");
const bodyParser = require('body-parser')
app.use(express.static('static'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.engine('spy', sprightly);
app.set('views', './static/');       // specify the views directory (its ./views by default)
app.set('view engine', 'spy'); // register the template engine

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/static/index.html'));
});

app.get('/auth', (req, res) => {
    var action = req.query.action;
    var get_referesh_token = (process.env.GET_REFRESH_TOKEN == 1)? "offline_access ": "";
    res.cookie('action', action, { maxAge: 900000, httpOnly: true });
    
    var scope= (process.env.GET_REFRESH_TOKEN == 1)? "offline_access ": "";
    console.log("\n in /auth, starting get code");
    console.log('action:' + action);
    switch(action) {
        case "user_id_api":
            scope += "read:me read:account";
            break;
        case "confluence_api":
            scope += "read:confluence-content.summary write:confluence-content read:confluence-space.summary write:confluence-space write:confluence-file read:confluence-props manage:confluence-configuration read:confluence-content.all write:confluence-props search:confluence read:confluence-content.permission read:confluence-groups write:confluence-groups readonly:content.attachment:confluence read:confluence-user";
        case "jira_svc_desk_api":
            scope += "read:servicedesk-request manage:servicedesk-customer write:servicedesk-request read:servicemanagement-insight-objects";
            break;
        case "jira_platform_rest_api":
            scope += "read:jira-user read:jira-work write:jira-work";
    }
    var url="https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id="+ 
        process.env.CLIENT_ID +
        "&scope="+ encodeURIComponent(scope) +
        "&redirect_uri=" + encodeURIComponent(process.env.HOST_NAME) + "/oauth-callback" + 
        "&state=" +  encodeURIComponent(process.env.MY_BOUND_VALUE) +
        "&response_type=code&prompt=consent"
        console.log("url: " + url);
    res.redirect(
      `${url}`
    );
  });
  

app.get('/oauth-callback', ({ query: { code } }, res) => {
  const body = {
    'grant_type': 'authorization_code',
    'client_id': process.env.CLIENT_ID,
    'client_secret': process.env.CLIENT_SECRET,
    'code': code,
    'redirect_uri': process.env.HOST_NAME + '/oauth-callback'
  };
  const opts = { headers: { accept: 'application/json', 'Content-Type': 'application/json' } };
  console.log("\n in /oauth-callback");
  console.log("code: " + code);
  console.log("body: ");
  console.log(body);
  console.log(opts);
  
  axios
    .post('https://auth.atlassian.com/oauth/token', body, opts)
    .then((_res) => {
        var token = _res.data.access_token;
        var refresh_token = (_res.data.refresh_token)? _res.data.refresh_token : "";
        res.cookie('refresh_token', refresh_token, { maxAge: 900000, httpOnly: true });

        console.log("\n in /oauth-callback, GET Token");
        console.log("response data: ");
        console.log(_res.data);
        
      res.redirect(`/accessible-resources?token=${token}`);
    })
    .catch((err) => res.status(500).json({ err: err.message }));

});



app.get('/accessible-resources', ({ query: { token } }, res) => {
    var url="https://api.atlassian.com/oauth/token/accessible-resources";
    // console.log("token: " + token)
    console.log("\n in /accessible-resources\n GET Header:");
    const opts = { headers: { accept: 'application/json',  'Authorization': 'Bearer ' + token} };
    console.log(opts);
    
    axios
        .get(url, opts)
        .then((response) => {
            console.log("response.data: ");
            console.log(response.data);
            res.render('done.spy', {data: JSON.stringify(response.data), token: token});
        })
        .catch((err) => res.status(500).json({ err: err.message }));
  
});

app.post('/appstart', (req, res) => {
    var action = req.cookies['action'];
    const token = req.body.token;
    const opts = { headers: { accept: 'application/json',  'Authorization': 'Bearer ' + token} };
    const payload = JSON.parse(req.body.payload);
    const submit_value = req.body.submit;
    if (submit_value == "Refresh token") {
        action = 'refresh-token';
    }

    console.log("action: " + action);
    console.log("req.body.payload ");
    console.log(payload);
    var cloud_id = '';
    var server = '';
    payload.forEach((entry) => {
        if (entry.name == process.env.ATLASSIAN_SITE_NAME) {
            cloud_id = entry.id;
            server = entry.url;
        }
    });
    var url = method = '';
    switch (action) {
        case 'user_id_api':
            url = 'https://api.atlassian.com/me';
            axios
                .get(url, opts)
                .then((response) => {
                    console.log("response.data: ");
                    console.log(response.data);
                    res.render('view.spy', {data: JSON.stringify(response.data)});
                })
                .catch((err) => res.status(500).json({ err: err.message }));
            break;
        case "confluence_api":
            // only testing confluence space api 
            url = 'https://api.atlassian.com/ex/confluence/'+ cloud_id + '/rest/api/space';

            // code below is untested
            axios
                .get(url, opts)
                .then((response) => {
                    console.log("response.data: ");
                    console.log(response.data);
                    res.render('view.spy', {data: JSON.stringify(response.data)});
                })
                .catch((err) => res.status(500).json({ err: err.message }));

        case "jira_svc_desk_api":
            scope = "read:servicedesk-request manage:servicedesk-customer write:servicedesk-request read:servicemanagement-insight-objects";
            console.log("jira_svc_desk_api is not covered.");
            res.sendFile(path.join(__dirname, '/static/done.html'));
            break;
        case "jira_platform_rest_api":
            url = 'https://api.atlassian.com/ex/jira/'+ cloud_id + '/rest/api/2/project';

            axios
                .get(url, opts)
                .then((response) => {
                    console.log("\n in /appstart, GET Jira API results:");
                    console.log("response.data: ");
                    console.log(response.data);
                    res.render('view.spy', {data: JSON.stringify(response.data)});
                })
                .catch((err) => res.status(500).json({ err: err.message }));
            break;
        case 'refresh-token':
            var refresh_token = req.cookies['refresh_token'];
            const body = {
                'grant_type': 'refresh_token',
                'client_id': process.env.CLIENT_ID,
                'client_secret': process.env.CLIENT_SECRET,
                'refresh_token': refresh_token
            };
            const opts2 = { headers: { accept: 'application/json', 'Content-Type': 'application/json' } };
            console.log("body:");
            console.log(body);
            
            axios
                .post('https://auth.atlassian.com/oauth/token', body, opts2)
                .then((_res) => {
                    var access_token = _res.data.access_token
                    var refresh_token = _res.data.refresh_token
                    console.log("\n in /appstart, GET Refresh Token");
                    console.log("response data: ");
                    console.log(_res.data);
                    
                    res.redirect(`/accessible-resources?token=${access_token}`);
                })
                .catch((err) => {
                    console.log(err.response.data);
                    res.status(err.response.status).json(err.response.data);
                });

    }
    //res.sendFile(path.join(__dirname, '/static/done.html'));
});
  


app.listen(3000);
// eslint-disable-next-line no-console
console.log('App listening on port 3000');
console.log("Running on host:" + process.env.HOST_NAME);
