const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs')
const qrcode = require('qrcode-terminal');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code to log in.');
});

client.on('ready', () => {
    console.log('WhatsApp client is ready!');
});

client.initialize();

// Middleware to handle JSON requests
app.use(express.json());

// Set up file storage using multer
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Save files with a timestamp
    },
});
const upload = multer({ storage: storage });

// API endpoint to send a text message
app.post('/send-message', (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).send('Phone number and message are required.');
    }

    const chatId = `${phoneNumber}@c.us`;

    client.sendMessage(chatId, message)
        .then(response => {
            res.status(200).send('Message sent successfully!');
        })
        .catch(err => {
            res.status(500).send('Failed to send the message: ' + err);
        });
});

// API endpoint to send media (images, audio, documents)
app.post('/send-media', upload.single('file'), (req, res) => {
    const { phoneNumber } = req.body;
    const file = req.file;

    if (!phoneNumber || !file) {
        return res.status(400).send('Phone number and media file are required.');
    }

    const chatId = `${phoneNumber}@c.us`;
    const filePath = path.resolve(__dirname, 'uploads', file.filename);

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
            res.status(500).send('Failed to send the media: ' + err);
        });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
