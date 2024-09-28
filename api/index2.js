const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode'); // Updated to use 'qrcode' package
const multer = require('multer');
const path = require('path');
const http = require('http');

let qrCodeData = ''; // Variable to store the QR code data
let clientReady = false; // Flag to track if the client is ready

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrCodeData = qr; // Store the QR code data in a variable
    console.log('QR code generated. Ready for scanning.');
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
    clientReady = true; // Set clientReady to true when the client is ready
});

client.on('authenticated', () => {
    console.log('WhatsApp client authenticated successfully!');
});

client.on('auth_failure', (msg) => {
    console.error('Authentication failure: ', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    clientReady = false; // Set clientReady to false if the client disconnects
});

client.initialize();

const app = express();
app.use(express.json());

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Save files with a timestamp
    },
});
const upload = multer({ storage: storage });

// API endpoint to get the WhatsApp QR code as an HTML image
app.get('/get-qr', async (req, res) => {
    if (qrCodeData) {
        try {
            // Generate base64 QR code from qrCodeData
            const qrImage = await qrcode.toDataURL(qrCodeData);

            // Return HTML with the embedded QR code image
            res.send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>WhatsApp QR Code</title>
                </head>
                <body>
                    <h1>Scan the QR Code with WhatsApp</h1>
                    <img src="${qrImage}" alt="WhatsApp QR Code" />
                </body>
                </html>
            `);
        } catch (err) {
            res.status(500).send('Error generating QR code image.');
        }
    } else {
        res.status(503).send('QR code not available yet, please try again.');
    }
});

// API endpoint to send a text message
app.post('/send-message', (req, res) => {
    const { phoneNumber, message } = req.body;

    // Check if the client is ready
    if (!clientReady) {
        return res.status(503).send('WhatsApp client not ready. Please try again later.');
    }

    if (!phoneNumber || !message) {
        return res.status(400).send('Phone number and message are required.');
    }

    const chatId = `${phoneNumber}@c.us`;

    client.sendMessage(chatId, message)
        .then(response => {
            res.status(200).send('Message sent successfully!');
        })
        .catch(err => {
            console.error('Failed to send the message: ', err);
            res.status(500).send('Failed to send the message: ' + err);
        });
});

// API endpoint to send media (images, audio, documents)
app.post('/send-media', upload.single('file'), (req, res) => {
    const { phoneNumber } = req.body;
    const file = req.file;

    // Check if the client is ready
    if (!clientReady) {
        return res.status(503).send('WhatsApp client not ready. Please try again later.');
    }

    if (!phoneNumber || !file) {
        return res.status(400).send('Phone number and media file are required.');
    }

    const chatId = `${phoneNumber}@c.us`;
    const filePath = path.resolve(__dirname, '..', 'uploads', file.filename);

    // Check if the file exists before sending
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found.');
    }

    // Load the media file using MessageMedia
    const media = MessageMedia.fromFilePath(filePath);

    client.sendMessage(chatId, media)
        .then(response => {
            res.status(200).send('Media sent successfully!');
        })
        .catch(err => {
            console.error('Failed to send the media: ', err);
            res.status(500).send('Failed to send the media: ' + err);
        });
});

// Set server URL and port
const port = process.env.PORT || 3000;
const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
