# ECHO - Product Requirements Document

---

## What is ECHO?

ECHO is a marketing tool for businesses. It keeps all your customer data in one place, lets you group customers based on their behavior, and helps you send them targeted marketing messages. It also has an AI assistant that can write campaign messages for you.

In simple terms: it's like a mini Mailchimp + CRM with AI built in.

---

## Who is this for?

- Marketing people at small or mid-size companies
- Business owners who run their own campaigns
- Anyone who manages customer data and wants to send targeted messages

---

## What problems does it solve?

1. **Customer data is all over the place** - ECHO puts all customers in one searchable database. You can also upload a CSV file to import them in bulk.

2. **You don't know who to target** - You can create customer groups (called "segments") using simple rules like "spent more than 5000" or "visited more than 3 times". You can even type in plain English like "high spending customers from Mumbai" and the AI will create the rules for you.

3. **Writing campaign messages is slow** - Just give the AI a campaign name and a short description. It writes the message for you.

4. **You can't see how campaigns are doing** - There's a dashboard that shows how many messages were sent, delivered, failed, opened, and clicked.

5. **No record of who did what** - Every action in the system is logged. You can see who created, edited, or deleted anything and when.

---

## Features

### 1. Login

- Sign in with Google (one click)
- Or sign in with email and password
- Stays logged in for 30 days

### 2. Customer Management

- Add, edit, and delete customers
- Each customer has a name, email, phone, address, how much they spent, and how many times they visited
- Upload a CSV file to add many customers at once
- See a timeline of what happened with each customer

### 3. Customer Segments

- Group customers using rules
  - Example: "total spent > 10000 AND visits > 5"
- Combine rules with AND / OR
- See how many customers match your segment
- **AI feature**: Type what you want in plain English and the AI creates the rules

### 4. Campaigns

- Pick a customer segment, write a message (or let AI write it), and send
- You can schedule a campaign for later
- Track how it went: how many sent, delivered, failed, opened, clicked
- Campaigns go through stages: Draft > Scheduled > Sending > Completed or Failed

### 5. Message Delivery

- When you send a campaign, each customer in the segment gets a message
- Each message is tracked: pending, delivered, or failed
- Right now delivery is simulated (not real email/SMS) - about 90% succeed, 10% fail randomly

### 6. Orders

- Track customer orders
- Each order has items, a total amount, shipping address, and a status
- Statuses: pending, processing, shipped, delivered, cancelled

### 7. Dashboard & Analytics

- Charts showing campaign performance, customer growth, and order trends
- Quick summary cards with key numbers

### 8. AI Chat

- A chat window where you can ask marketing questions
- Good for brainstorming campaign ideas or getting help with copy
- Powered by Llama 3.3 (a large language model from Meta, hosted on Groq)

### 9. Email Templates

- Create and save reusable message templates
- Each user has their own templates

### 10. Webhooks

- Set up URLs that get notified when things happen in the system
- Example: get a notification when a new customer is created or a campaign is sent
- If a webhook keeps failing, it gets turned off automatically

### 11. Audit Logs

- A full history of everything that happened in the system
- Shows who did what, to which record, and what changed
- You can filter by user, action type, or date

### 12. Live Updates

- The screen updates automatically when something changes (like a campaign finishing)
- No need to refresh the page

---

## Pages in the App

| Page | What you see there |
|---|---|
| Landing Page | Product info and a "Sign in with Google" button |
| Dashboard | Overview with charts and key numbers |
| Customers | List of all customers, add/edit/delete, CSV import |
| Segments | Create customer groups using rules or plain English |
| Campaigns | Create campaigns, generate AI messages, send them, see results |
| Orders | View and create customer orders |
| Analytics | Detailed charts for campaigns, customers, and orders |
| AI Chat | Ask the AI marketing questions |
| Templates | Build and save email templates |
| Webhooks | Set up event notifications to external URLs |
| Audit Logs | See the full history of all actions |

---

## How it works (simple version)

```
User opens the app in their browser
        |
        v
React app (the frontend) talks to the Express server (the backend)
        |
        v
The server stores everything in MongoDB (the database)
        |
        v
When you ask AI to write something, the server calls the Groq AI API
        |
        v
Live updates come through Socket.io (so the page updates without refreshing)
```

---

## What's real and what's simulated

| Feature | Real or Simulated? |
|---|---|
| Customer data | Real - stored in MongoDB |
| Segments and rules | Real - runs actual database queries |
| AI message writing | Real - calls Groq AI API |
| AI natural language to rules | Real - calls Groq AI API |
| AI Chat | Real - calls Groq AI API |
| Message delivery | Simulated - fake vendor API (90% success, 10% random failure) |
| Email open/click tracking | Built but depends on real delivery to work |
| Webhooks | Real - sends HTTP requests to the URLs you configure |
| Audit logs | Real - every action is recorded |

---

## What's NOT included yet

- **No real email or SMS sending** - Messages are simulated, not actually delivered
- **No permission controls** - User roles exist (admin, manager, user, viewer) but the app doesn't check them yet. Everyone can do everything.
- **No tests** - There are no automated tests
- **No forgot password** - If you forget your password, there's no reset flow. Use Google login instead.
- **No multi-company support** - Everyone sees the same data. There's no concept of separate organizations.

---

## Tech used (for reference)

- **Frontend**: React, TypeScript, Material UI, Redux
- **Backend**: Node.js, Express, TypeScript
- **Database**: MongoDB Atlas
- **AI**: Groq API (Llama 3.3 70B model)
- **Login**: Google OAuth + JWT tokens
- **Live updates**: Socket.io
- **Event streaming**: Apache Kafka (optional, works without it)
- **Deployment**: Render (server) + Netlify (frontend)
