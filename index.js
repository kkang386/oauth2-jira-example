require('dotenv').config();
const axios = require('axios');
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('static'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/static/index.html'));
});

app.get('/done', (req, res) => {
    res.sendFile(path.join(__dirname, '/static/done.html'));
  });
  

app.get('/auth', (req, res) => {
    console.log("\n in /auth, starting get code");
    var url2="https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id="+ 
        process.env.CLIENT_ID +
        "&scope=read%3Ame%20read%3Aaccount&redirect_uri=" +
        encodeURIComponent(process.env.HOST_NAME) + "/oauth-callback&state=" + 
        encodeURIComponent(process.env.MY_BOUND_VALUE) +
        "&response_type=code&prompt=consent"
        console.log("url2: " + url2);
    res.redirect(
      `${url2}`
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
    .then((_res) => _res.data.access_token)
    .then((token) => {
        console.log("\n in /oauth-callback, GET Token");
        console.log('Received token:', token);

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
  
        res.redirect('/done');
      })
      .catch((err) => res.status(500).json({ err: err.message }));
  
});

app.listen(3000);
// eslint-disable-next-line no-console
console.log('App listening on port 3000');
console.log("Running on host:" + process.env.HOST_NAME);
