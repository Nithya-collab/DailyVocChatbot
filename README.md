AI Vocabulary Reminder Chatbot

An AI-powered chatbot that sends 5 new vocabulary words daily to users via Email or Telegram.
Users can interact with the bot using natural language (ex: “remind me after 1 hour”, “repeat”, “stop reminders”).
Built using Next.js + Firebase + OpenAI/Gemini API.

1. Project Overview

This project provides an AI-based vocabulary learning assistant.
Users receive daily word notifications and can chat with the bot to schedule reminders or repeat lessons.

Sends 5 vocabulary words daily

AI chatbot understands natural-language replies

Users can delay reminders (ex: “remind me after 1 hour”)

Delivery through Email (free) or Telegram (free)

All data stored in Firebase

No machine learning model training required

2. Features

Daily vocabulary delivery

AI-powered message understanding

Commands like:

“remind me after 1 hour”

“repeat”

“stop notifications”

Email or Telegram message delivery

Real-time updates using Firestore

Simple dashboard (Next.js) for user settings

Cloud Functions handle automation & scheduling

3. Tech Stack
Frontend

Next.js (user settings, profile, history)

Backend

Firebase Authentication

Cloud Firestore

Firebase Cloud Functions (scheduled tasks + bot logic)

AI Engine

OpenAI API or Google Gemini API
(Used to understand user messages and generate responses)

Notification Methods

Email (Nodemailer) – Free

Telegram Bot API – Free

WhatsApp (Optional, paid via Twilio)

4. How It Works

User signs up and chooses notification method.

Cloud Function sends 5 new vocabulary words every morning.

User replies to the bot using natural language.

Message is processed by OpenAI/Gemini API.

Firestore updates user settings (reminders, preferences).

Cloud Function schedules follow-up reminders if needed.

5. Example User Flow

Bot sends: Your 5 words for today!

User replies: “remind me after 1 hour”

Bot understands and schedules a reminder

After 1 hour → sends the same words again

Next day → sends a new set automatically