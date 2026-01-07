
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from root .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: "vocab-users.firebaseapp.com",
    projectId: "vocab-users",
    storageBucket: "vocab-users.firebasestorage.app",
    messagingSenderId: process.env.VITE_FIREBASE_SENDER_ID,
    appId: process.env.VITE_FIREBASE_API_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Email Transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // App Password
    },
});

const getTodayDateString = () => {
    return new Date().toISOString().split('T')[0];
};

async function sendDailyEmails() {
    try {
        console.log("🚀 Starting Daily Email Service...");

        // 1. Fetch Today's Word
        const today = getTodayDateString();
        const wordRef = doc(db, "words", today);
        const wordSnap = await getDoc(wordRef);

        if (!wordSnap.exists()) {
            console.log(`❌ No word found for date: ${today}. run the app to generate it!`);
            return;
        }

        const wordData = wordSnap.data();
        console.log(`✅ Found word: ${wordData.word}`);

        // 2. Fetch Subscribers
        const subsSnap = await getDocs(collection(db, "subscribers"));
        const emails = subsSnap.docs.map(doc => doc.data().email);
        console.log(`📧 Sending to ${emails.length} subscribers...`);

        if (emails.length === 0) return;

        // 3. Email Content (HTML)
        const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #2563eb; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Daily Visual Vocab</h1>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2563eb; font-size: 32px; text-transform: capitalize; margin-top: 0;">${wordData.word}</h2>
          <p style="font-style: italic; color: #666; font-size: 18px;">/ ${wordData.pronunciation} /</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-left: 5px solid #2563eb; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;"><strong>Meaning:</strong> ${wordData.definition}</p>
            ${wordData.tamilMeaning ? `<p style="margin: 10px 0 0 0; color: #000;"><strong>Tamil:</strong> ${wordData.tamilMeaning}</p>` : ''}
          </div>

          <p style="font-size: 16px;"><strong>Example:</strong> "${wordData.example}"</p>

          <img src="${wordData.imageUrl}" alt="${wordData.word}" style="width: 100%; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #999;">
            <p>Keep learning! See you tomorrow.</p>
          </div>
        </div>
      </div>
    `;

        // 4. Send Emails
        // Send individually or as BCC to avoid leaking emails. BCC is better for bulk.
        // For "Personal" touch, individual is better, but takes longer. 
        // Demo mode: BCC is fine or loop. Loop is safer for small lists to avoid spam filters flagging BCC.

        for (const email of emails) {
            await transporter.sendMail({
                from: '"NithiBot" <' + process.env.EMAIL_USER + '>',
                to: email,
                subject: `📘 Today's Word: ${wordData.word.charAt(0).toUpperCase() + wordData.word.slice(1)}`,
                html: htmlContent,
            });
            console.log(`   ➜ Sent to ${email}`);
        }

        console.log("🎉 All emails sent successfully!");

    } catch (error) {
        console.error("❌ Error running email service:", error);
    }
}

sendDailyEmails();
