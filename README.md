# Student Document Upload System — Setup Guide

## Ye kya hai?
College WiFi pe chalne wala ek local upload system. Students apne phone/laptop se ek link kholenge,
apna Naam + Roll Number daalenge, aur apni PDF files (Aadhaar, marksheet, certificate, photo, signature)
upload karenge. Files seedha tere PC pe, naam-roll wale folder mein save ho jaayengi.

Koi cloud, koi Google, koi third-party server involved nahi hai — sab kuch tere PC ke andar, tere WiFi
network ke through hi hota hai. Data kahin bahar nahi jaata.

---

## Step 1: Node.js install karo (agar pehle se nahi hai)
1. https://nodejs.org pe jao
2. "LTS" wala version download karo (Windows ke liye .msi file)
3. Install kar lo — sab "Next, Next, Finish" hi hai

Check karne ke liye, Command Prompt khol ke ye likho:
```
node --version
```
Agar version number dikhe (jaise v20.x.x), matlab install ho gaya.

---

## Step 2: Is folder ko apne PC pe rakho
Ye poora `student-upload` folder kahin bhi rakh do (jaise Desktop pe).

---

## Step 3: Packages install karo
Command Prompt kholo, is folder ke andar jao (cd command se), fir likho:
```
npm install
```
Ye ek baar karna hai. Internet chahiye is step ke liye (sirf packages download karne ke liye).

---

## Step 4: Server start karo
Usi Command Prompt mein likho:
```
node server.js
```
Agar ye dikhe:
```
Server running! Students can access it at:
  http://<tumhare-PC-ka-IP>:3000
```
Matlab server chalu ho gaya. **Is Command Prompt window ko band mat karna** — jab tak ye chalu hai,
tabhi students upload kar payenge. Kaam khatam hone ke baad Ctrl+C dabake band kar sakte ho.

---

## Step 5: Apna PC ka IP address pata karo
Command Prompt mein likho:
```
ipconfig
```
"IPv4 Address" ke saamne jo number hai (jaise 192.168.1.45), wahi tera IP hai.

---

## Step 6: Students ko link do
Students ko ye link batao (apna IP daal ke):
```
http://192.168.1.4:3000
```
(Apna actual IP daalna, ye sirf example hai)

Students apne phone ya laptop se — **jo college WiFi se connected ho** — ye link kholenge,
naam + roll likhenge, files select karenge, Upload dabayenge. Bas.

---

## Files kahan jaayengi?
`student-upload` folder ke andar ek `student_data` folder apne aap ban jayega. Uske andar
har student ka apna folder hoga, naam se:
```
student_data/
  Ashish_Kumar_2024CS105/
    1782050588345_aadhar.pdf
    1782050588345_marksheet.pdf
  Priya_Sharma_2024CS106/
    ...
```

---

## Zaroori baatein
- Agar koi student dobara submit kare (same naam-roll se), purani files delete NAHI hongi —
  nayi files add ho jaayengi usi folder mein. Duplicate check tu khud manually karega.
- Har file max 50MB tak ki ho sakti hai (galti se bada file daalne se system slow na ho, isliye).
- Server sirf tab tak kaam karega jab tak Command Prompt window khuli hai aur tera PC on hai.
- Agar PC restart ho jaye, dubara Step 4 follow karo (`node server.js`).
"# student-upload" 
