const express = require('express');
const path = require('path');
const app = express();

const http = require('http');
const fs = require('fs');
let server, key, cert;

app.use(express.static(__dirname));

let ejs = require('ejs');

app.engine('.html', ejs.renderFile);
app.set('view engine', 'html');

let api = require('./api');

app.get('/render', async (req, res, next) => {
    await api.render();
    res.status(200).send({ message: 'Done' })
})

app.post('/render', async (req, res, next) => {
    const items = req.body.data;
    await api.render(items);
    res.status(200).send({ message: 'Done' })
})

app.listen(7777);
console.log('http://localhost:7777')
