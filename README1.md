# 📄 Student Document Upload Portal

A lightweight self-hosted web app that lets students upload their documents (PDF / Images) from any device using a simple link — no WhatsApp chaos, no email mess.

Built for **Vivekanand College of Nursing, Bhubaneswar** but works for any institution.

---

## 📸 Screenshots

| Upload Form | Success Page |
|---|---|
| ![Upload Form](frontend.jpeg) | ![Success Page](output.jpeg) |

---

## ✨ Features

- Students fill their **Name** and **Roll Number**, then upload files
- Files are automatically saved in a folder named `StudentName_RollNo`
- Supports **PDF, JPG, PNG** — up to 50MB per file
- Works on **any device** — mobile, tablet, laptop
- Admin can view all uploads at `/files`
- Glassmorphism UI with college logo

---

## 📁 Folder Structure

```
student-upload-main/
├── public/
│   ├── index.html        ← Upload form (frontend)
│   └── logo.png          ← College logo (place it here)
├── student_data/         ← All uploaded files saved here (auto-created)
├── server.js             ← Main server
├── package.json
├── start.bat             ← Double-click to start everything (Windows)
└── README.md
```

---

## ⚙️ Requirements

Install these once on the PC that will run the server:

### 1. Node.js
Download from: https://nodejs.org  
Choose **LTS version** → Install with all defaults (Next → Next → Finish)

### 2. Cloudflared
Open **Command Prompt** and run:
```
winget install --id Cloudflare.cloudflared
```
Close CMD after install, open a fresh one to continue.

---

## 🚀 Setup (First Time Only)

**Step 1 — Download this project**

Go to the green **Code** button on GitHub → click **Download ZIP** → Extract it to your `Downloads` folder.

Your path should look like:
```
C:\Users\YourName\Downloads\student-upload-main\
```

**Step 2 — Add college logo**

Place your college logo file named exactly `logo.png` inside the `public` folder:
```
Downloads\student-upload-main\public\logo.png
```

**Step 3 — Install dependencies**

Open CMD, run:
```
cd Downloads\student-upload-main
npm install
```

---

## ▶️ How to Start the Server

### Easy way — Double click `start.bat`

Just double-click `start.bat` inside the `student-upload-main` folder.  
Two CMD windows will open automatically.

### Manual way — Two CMDs

**CMD 1 — Start server:**
```
cd Downloads\student-upload-main
node server.js
```

**CMD 2 — Start tunnel (new CMD window):**
```
cloudflared tunnel --url http://localhost:3000 --protocol http2
```

---

## 🔗 Sharing the Link

After running the tunnel, CMD 2 will show a link like:
```
https://random-words.trycloudflare.com
```

**Share this link with students.** They can open it on any device, any network (WiFi or mobile data).

> ⚠️ Note: The link changes every time you restart the tunnel. Share the new link each session.

---

## 📂 Viewing Uploaded Files

Open this URL in your browser while server is running:
```
http://localhost:3000/files
```

All student folders and their uploaded files will be listed here.

Uploaded files are saved at:
```
Downloads\student-upload-main\student_data\StudentName_RollNo\
```

---

## 🛑 How to Stop

Press `Ctrl + C` in both CMD windows.

---

## 🛠️ Tech Stack

- **Node.js** + **Express** — backend server
- **Multer** — file upload handling
- **Cloudflared** — tunnel to expose local server to internet
- **Vanilla HTML/CSS** — glassmorphism frontend

---

## 👤 Author

Made with ❤️ by **CouragE**  
GitHub: [@gamebar221](https://github.com/gamebar221)
