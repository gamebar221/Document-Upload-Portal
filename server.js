require("dotenv").config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const archiver = require('archiver');
const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = 3000;

// ─── Config ───────────────────────────────────────────────────────────────
const B2_KEY_ID      = process.env.B2_KEY_ID;
const B2_APP_KEY     = process.env.B2_APP_KEY;
const B2_BUCKET_ID   = process.env.B2_BUCKET_ID;
const B2_BUCKET_NAME = 'student-documents';
const B2_ENDPOINT    = 'https://s3.ca-east-006.backblazeb2.com';
const ADMIN_USER     = process.env.ADMIN_USER;
const ADMIN_PASS     = process.env.ADMIN_PASS;
const SESSION_SECRET = process.env.SESSION_SECRET || 'changeme_secret_123';

const s3 = new S3Client({
  endpoint: B2_ENDPOINT,
  region: 'ca-east-006',
  credentials: {
    accessKeyId: B2_KEY_ID,
    secretAccessKey: B2_APP_KEY,
  },
});
// ──────────────────────────────────────────────────────────────────────────

function sanitize(input) {
  return input.trim().replace(/[\/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
}

function esc(str) {
  return String(str).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// archiver's export shape keeps moving between majors: v5-v7 expose both a callable
// export and .create(), v8 dropped the callable one entirely. The version is pinned in
// package.json, but normalise here so a stray upgrade fails loudly instead of mid-download.
function createZip() {
  if (typeof archiver === 'function') return archiver('zip', { zlib: { level: 6 } });
  if (typeof archiver.create === 'function') return archiver.create('zip', { zlib: { level: 6 } });
  throw new Error('Unsupported archiver version — run: npm install archiver@7.0.1 --save-exact');
}

// ListObjectsV2 returns max 1000 keys per call — keep paging until the bucket is done.
async function listAllObjects(prefix = '') {
  const objects = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: B2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    if (page.Contents) objects.push(...page.Contents);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  // Drop the zero-byte "folder marker" keys that B2 sometimes creates.
  return objects.filter(obj => !obj.Key.endsWith('/') && obj.Size > 0);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 2 * 60 * 60 * 1000 },
}));

// --- Auth Middleware ---
function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/login');
}

// --- Login Page ---
app.get('/login', (req, res) => {
  const error = req.query.error ? '<p style="color:red;margin:0 0 15px;">Invalid username or password.</p>' : '';
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Login</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; min-height: 100vh; display: flex; justify-content: center; align-items: center; background: #0a0e1a; }
        .card { background: rgba(255,255,255,0.07); backdrop-filter: blur(24px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 8px 32px rgba(0,0,0,0.4); padding: 40px 32px; width: 100%; max-width: 380px; }
        h2 { color: #fff; margin-bottom: 24px; text-align: center; }
        label { color: rgba(255,255,255,0.6); font-size: 13px; display: block; margin-bottom: 6px; }
        input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #fff; font-size: 15px; margin-bottom: 16px; outline: none; }
        input:focus { border-color: #3b5bdb; }
        button { width: 100%; padding: 12px; background: linear-gradient(135deg, #3b5bdb, #5c3bc4); color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; }
        button:hover { opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🔐 Admin Login</h2>
        ${error}
        <form method="POST" action="/login">
          <label>Username</label>
          <input type="text" name="username" required autofocus />
          <label>Password</label>
          <input type="password" name="password" required />
          <button type="submit">Login</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// --- Login POST ---
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    res.redirect('/files');
  } else {
    res.redirect('/login?error=1');
  }
});

// --- Logout ---
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// --- Home ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Upload ---
app.post('/upload', upload.array('files'), async (req, res) => {
  const name = req.body.studentName;
  const roll = req.body.rollNo;
  const files = req.files;

  if (!name || !roll || !files || files.length === 0) {
    return res.status(400).send(`
      <h2 style="font-family:sans-serif;color:red;">Error: Name, Roll No, and at least one file are required.</h2>
      <a href="/">Go back</a>
    `);
  }

  const safeName = sanitize(name);
  const safeRoll = sanitize(roll);
  const folderName = `${safeName}_${safeRoll}`;

  try {
    for (const file of files) {
      const timestamp = Date.now();
      const safeOriginalName = sanitize(path.parse(file.originalname).name);
      const ext = path.extname(file.originalname);
      const fileName = `${timestamp}_${safeOriginalName}${ext}`;
      const key = `${folderName}/${fileName}`;

      await s3.send(new PutObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Upload Successful</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #0a0e1a; position: relative; overflow: hidden; padding: 20px; }
          .orb { position: fixed; border-radius: 50%; filter: blur(80px); opacity: 0.3; z-index: 0; }
          .orb1 { width: 400px; height: 400px; background: radial-gradient(circle, #3b2f8f, #1a0a5e); top: -150px; left: -150px; }
          .orb2 { width: 350px; height: 350px; background: radial-gradient(circle, #8f2f6a, #5e0a3a); bottom: -100px; right: -100px; }
          .card { position: relative; z-index: 10; width: 100%; max-width: 420px; background: rgba(255,255,255,0.07); backdrop-filter: blur(24px); border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 8px 32px rgba(0,0,0,0.4); padding: 40px 32px 32px; text-align: center; }
          .icon { font-size: 56px; margin-bottom: 16px; }
          h2 { color: #ffffff; font-size: 22px; margin-bottom: 10px; }
          p { color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 28px; line-height: 1.6; }
          p b { color: rgba(255,255,255,0.9); }
          a { display: inline-block; padding: 13px 32px; background: linear-gradient(135deg, #3b5bdb, #5c3bc4); color: white; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; }
          footer { position: relative; z-index: 10; margin-top: 24px; color: rgba(255,255,255,0.25); font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="orb orb1"></div>
        <div class="orb orb2"></div>
        <div class="card">
          <div class="icon">✅</div>
          <h2>Upload Successful!</h2>
          <p><b>${files.length}</b> file(s) uploaded for<br><b>${name} (${roll})</b>.</p>
          <a href="/">Upload More / Next Student</a>
        </div>
        <footer>Made with ❤️ by CouragE &#x00A9; 2026 MIT Licensed</footer>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send(`<h2 style="font-family:sans-serif;color:red;">Upload failed.</h2><a href="/">Go back</a>`);
  }
});

// --- View Files ---
app.get('/files', requireAuth, async (req, res) => {
  try {
    const objects = await listAllObjects();

    let html = `
      <html><head><title>Uploaded Student Data</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: sans-serif; padding: 20px; background: #0a0e1a; color: #fff; }
        h2 { color: #fff; margin: 0; }
        .topbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 6px; }
        .actions { display: flex; align-items: center; gap: 10px; }
        .summary { color: rgba(255,255,255,0.4); font-size: 13px; margin-bottom: 20px; }
        .student-block { background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px 20px; margin: 15px 0; }
        h3 { color: #aaa; margin: 0 0 10px; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { background: rgba(255,255,255,0.07); padding: 8px 12px; margin: 4px 0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; gap: 12px; }
        li span.size { color: rgba(255,255,255,0.35); font-size: 12px; white-space: nowrap; }
        a.zip { background: #2ecc71; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
        a.zip:hover { background: #27ae60; }
        a.logout { background: #c0392b; color: white; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 14px; }
      </style></head><body>
      <div class="topbar">
        <h2>📁 Uploaded Student Data</h2>
        <div class="actions">
          <a class="zip" href="/download-all-zip">⬇ Download ALL Students ZIP</a>
          <a class="logout" href="/logout">Logout</a>
        </div>
      </div>
    `;

    if (objects.length === 0) {
      html += '<p>No uploads yet.</p></body></html>';
      return res.send(html);
    }

    const folders = {};
    objects.forEach(obj => {
      const slash = obj.Key.indexOf('/');
      const folder = slash === -1 ? 'Unsorted' : obj.Key.slice(0, slash);
      const file = slash === -1 ? obj.Key : obj.Key.slice(slash + 1);
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push({ file, size: obj.Size });
    });

    const totalBytes = objects.reduce((sum, obj) => sum + obj.Size, 0);
    html += `<p class="summary">${Object.keys(folders).length} students &middot; ${objects.length} files &middot; ${formatBytes(totalBytes)} total</p>`;

    for (const folder of Object.keys(folders).sort()) {
      html += `
        <div class="student-block">
          <h3>${esc(folder)} (${folders[folder].length} files)</h3>
          <ul>
      `;
      for (const { file, size } of folders[folder]) {
        html += `<li><span>${esc(file)}</span><span class="size">${formatBytes(size)}</span></li>`;
      }
      html += '</ul></div>';
    }

    html += '</body></html>';
    res.send(html);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).send('<h2>Error fetching files.</h2>');
  }
});

// --- Download EVERY student's files as one ZIP ---
app.get('/download-all-zip', requireAuth, async (req, res) => {
  let archive;

  try {
    const objects = await listAllObjects();

    if (objects.length === 0) {
      return res.status(404).send('<h2 style="font-family:sans-serif">Nothing to download — no files uploaded yet.</h2><a href="/files">Go back</a>');
    }

    archive = createZip();

    // Without this handler an archiver error is an unhandled 'error' event,
    // which takes the whole process down and shows ERR_INVALID_RESPONSE.
    archive.on('warning', err => console.warn('ZIP warning:', err));
    archive.on('error', err => {
      console.error('ZIP stream error:', err);
      res.destroy(err);
    });

    // Admin closed the tab / cancelled — stop pulling files out of B2.
    res.on('close', () => {
      if (!res.writableFinished && archive) archive.abort();
    });

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="all-students-${stamp}.zip"`);
    archive.pipe(res);

    // Pull each file fully into memory before appending it.
    // Appending the live B2 streams instead leaves every later stream idle
    // waiting its turn until the socket times out — that was the ZIP failure.
    for (const obj of objects) {
      const file = await s3.send(new GetObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: obj.Key,
      }));
      const bytes = await file.Body.transformToByteArray();
      // obj.Key keeps the "StudentName_Roll/" prefix, so the ZIP stays foldered.
      archive.append(Buffer.from(bytes), { name: obj.Key });
    }

    await archive.finalize();
  } catch (err) {
    console.error('ZIP error:', err);
    if (archive) archive.abort();
    if (!res.headersSent) {
      return res.status(500).send('<h2 style="font-family:sans-serif;color:red;">Failed to create ZIP.</h2><a href="/files">Go back</a>');
    }
    res.destroy(err);
  }
});

// --- Error handler ---
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).send(`<h2 style="font-family:sans-serif;color:red;">Error: File larger than 50MB.</h2><a href="/">Go back</a>`);
  }
  next(err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
