'use strict';
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const customAlphabet = require('nanoid/async').customAlphabet;
const sqlite3 = require('sqlite3');
const open = require('sqlite').open;
const upath = require('upath');

const config = require('./config.json');
const nanoid = customAlphabet(config.customAlphabet, config.urlSize);
const app = express();

open({
    filename: './volume/db.sqlite3',
    driver: sqlite3.Database
}).then(async db => {
    await db.migrate({force: false });
    await db.close();
});

app.use(fileUpload({
    useTempFiles: true,
    createParentPath: true,
    abortOnLimit: true,
    tempFileDir: '/tmp/',
    debug: false,
    limits: { fileSize: 100 * 1024 * 1024 } // 100mb
}));

app.use(helmet());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(morgan('dev'));

app.get('/', express.static(upath.joinSafe(__dirname, 'public/')));

app.get('/:name', async (req, res, next) => {
    const name = req.params.name;

    const db = await open({
        filename: './volume/db.sqlite3',
        driver: sqlite3.Database
    });

    const q = await db.get('SELECT removed FROM files WHERE url=?', name);

    if (!q) return res.send('404 File Not Found\n');
    if (q.removed) return res.status(451).send('451 Unavailable For Legal Reasons\n');

    const p = upath.joinSafe(__dirname, 'volume/uploads/');

    return express.static(p, {index: q.url})(req, res, next);
});

app.post('/', async (req, res) => {
    const die = message => {
        return res.send({
            err: true,
            message
        });
    };

    try {
        if (!req.files.file) return die('No file uploaded');
        const f = req.files.file;

        if (config.mime.indexOf(f.mimetype) != -1) return die('File has an invalid mimetype');
        
        const db = await open({
            filename: './volume/db.sqlite3',
            driver: sqlite3.Database
        });

        const q = await db.get('SELECT url FROM files WHERE hash=?', f.md5);

        if (q) {
            f.mv('/dev/null');
            return res.send(`${config.baseUrl}${q.url}\n`);
        }

        const id = await nanoid();
        const ext = upath.parse(f.name).ext;
        const url = `${id}${ext}`;

        await db.run('INSERT INTO files (url, hash, ip) VALUES (?, ?, ?)',
            [url, f.md5, req.headers['x-original-forwarded-for']]
        );

        f.mv(upath.joinSafe(__dirname, `volume/uploads/${url}`));
        
        return res.send(`${config.baseUrl}${url}\n`);
    }
    catch (e) {
        console.error(e);
        res.status(500);
        return die('Internal error');
    }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Started express on localhost:${port}`);
});
