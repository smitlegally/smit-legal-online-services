# SMIT Legal – Single Upload Master Project

## Render
- Build Command: `npm install`
- Start Command: `npm start` (or `node server.js`)
- Service type: Web Service / Node

## Included master features
- Main Service → Sub-service → Sub-option → Documents → Charges → Guidance → Done/Save/Back
- Add Main Service / Add Sub-service / Add Sub-option from Admin
- Admin Search for services, sub-services, sub-options and Tracking IDs
- Customer files: Today-first Pending queue, Mobile/Order ID search, Completed Files folder
- Updated file upload moves the item out of Pending and into Completed Files
- Invoice/Tracking support retained
- Daily Sales Excel report with Government Charges, Smit Service Charges and Total Received
- Browser order data syncs to the server for report generation
- 10 PM IST scheduled report delivery
- Email + WhatsApp API hooks through environment variables

## Required environment variables for unattended delivery
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
REPORT_EMAIL=smitlegally@gmail.com
REPORT_WHATSAPP=91XXXXXXXXXX
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_API_VERSION=v23.0

Do not commit secrets to GitHub. Put them in Render Environment Variables.
