'use strict';

require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// const xlsx = require('xlsx');
const nodemailer = require('nodemailer');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { body, validationResult } = require('express-validator');

const app = express();
const port = 3000;

// --- Middleware Setup ---
app.use(express.json()); // To parse JSON bodies for login
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'a-very-secret-key-for-sessions', // Use an env var for this in production
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // Set to true if using HTTPS, 24-hour session
}));

// Serve static files from the current directory
app.use(express.static(__dirname));

// --- Multer Configuration ---
// Destination for file uploads
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename to avoid overwrites
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });


// Excel file handling removed

// --- Nodemailer Email Configuration ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendNotificationEmail(data, file) {
    // Construct a clean HTML body for the email
    const emailBody = `
        <h1 style="color: #D4AF37;">New Loan Application Received</h1>
        <p>A new application has been submitted via the website. The data has been saved to the Excel file.</p>
        <hr>
        <h3 style="color: #333;">Applicant Details:</h3>
        <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%;">
            <tr style="background-color: #f2f2f2;">
                <td style="width: 30%;"><strong>Name:</strong></td>
                <td>${data.name || 'N/A'}</td>
            </tr>
            <tr><td><strong>Phone:</strong></td><td>${data.phone || 'N/A'}</td></tr>
            <tr style="background-color: #f2f2f2;"><td><strong>Email:</strong></td><td>${data.email || 'N/A'}</td></tr>
            <tr><td><strong>City:</strong></td><td>${data.city || 'N/A'}</td></tr>
            <tr style="background-color: #f2f2f2;"><td><strong>Loan Type:</strong></td><td>${data.loanType || 'N/A'}</td></tr>
            <tr><td><strong>Desired Amount (₹):</strong></td><td>${data.loanAmount || 'N/A'}</td></tr>
            <tr style="background-color: #f2f2f2;"><td><strong>Jewelry Type:</strong></td><td>${data.jewelryType || 'N/A'}</td></tr>
            <tr><td><strong>Grams:</strong></td><td>${data.grams || 'N/A'}</td></tr>
            <tr style="background-color: #f2f2f2;"><td><strong>Document Path:</strong></td><td>${data.loanDocumentPath || 'N/A'}</td></tr>
            <tr><td valign="top"><strong>Message:</strong></td><td valign="top">${data.message || 'N/A'}</td></tr>
        </table>
    `;

    const mailOptions = {
        from: `"Gold 2 Money Notifier" <${process.env.EMAIL_USER}>`,
        to: process.env.NOTIFICATION_RECIPIENT,
        subject: `New Loan Application from ${data.name}`,
        html: emailBody,
        attachments: []
    };

    // If a file was uploaded, add it as an attachment to the notification email
    if (file) {
        mailOptions.attachments.push({
            filename: file.originalname, // Use the original file name for the attachment
            path: file.path              // Path to the file saved by multer
        });
    }

    try {
        await transporter.sendMail(mailOptions);
        console.log('Notification email sent successfully.');
        // Clean up the uploaded file from the server after it has been sent
        if (file && fs.existsSync(file.path)) {
            fs.unlink(file.path, (err) => {
                if (err) {
                    console.error('Error deleting uploaded file:', err);
                } else {
                    console.log('Uploaded file deleted successfully:', file.path);
                }
            });
        }
    } catch (error) {
        console.error('Error sending notification email:', error);
        // We log the error but don't stop the process. The user's submission is already saved.
    }
}

// --- Nodemailer Auto-Reply Email ---
async function sendAutoReplyEmail(data) {
    if (!data.email) {
        console.log('No user email provided, skipping auto-reply.');
        return;
    }

    const autoReplyBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #f9f9f9;">
                <div style="text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; margin-bottom: 20px;">
                    <h1 style="color: #D4AF37; margin: 0;">Gold 2 Money</h1>
                </div>
                <h2 style="color: #333;">Thank You for Your Application, ${data.name}!</h2>
                <p>Dear ${data.name},</p>
                <p>We have successfully received your loan application/enquiry. Thank you for choosing Gold 2 Money.</p>
                <p>Our team is reviewing your details and will get in touch with you shortly to discuss the next steps. We are committed to providing you with the best possible service.</p>
                <p><strong>Here is a summary of the information you submitted:</strong></p>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; background-color: #fff;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="width: 30%;"><strong>Name:</strong></td>
                        <td>${data.name || 'N/A'}</td>
                    </tr>
                    <tr><td><strong>Phone:</strong></td><td>${data.phone || 'N/A'}</td></tr>
                    <tr style="background-color: #f2f2f2;"><td><strong>Loan Type:</strong></td><td>${data.loanType || 'N/A'}</td></tr>
                    <tr><td><strong>Desired Amount (₹):</strong></td><td>${data.loanAmount || 'N/A'}</td></tr>
                </table>
                <p style="margin-top: 20px;">If you have any immediate questions, please feel free to contact us at <a href="tel:+919594607030">+91 95946 07030</a> or reply to this email.</p>
                <p>Best Regards,<br><strong>The Gold 2 Money Team</strong></p>
                <div style="text-align: center; font-size: 12px; color: #777; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px;">
                    <p>&copy; ${new Date().getFullYear()} Gold 2 Money. All Rights Reserved.</p>
                </div>
            </div>
        </div>
    `;

    const mailOptions = {
        from: `"Gold 2 Money" <${process.env.EMAIL_USER}>`,
        to: data.email,
        subject: 'We Have Received Your Loan Application - Gold 2 Money',
        html: autoReplyBody,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Auto-reply email sent successfully to ${data.email}.`);
    } catch (error) {
        console.error(`Error sending auto-reply email to ${data.email}:`, error);
    }
}

// --- Validation Rules for the Application Form ---
const loanApplicationValidationRules = [
    // Name must not be empty
    body('name').trim().not().isEmpty().withMessage('Name is required.'),
    
    // Email must be a valid email address
    body('email').isEmail().withMessage('Please provide a valid email address.'),
    
    // Phone must be a valid 10-digit number
    body('phone')
        .trim()
        .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits.')
        .isNumeric().withMessage('Phone number must contain only digits.'),

    // City must not be empty
    body('city').trim().not().isEmpty().withMessage('City is required.'),

    // Custom validation: If loan type is 'Takeover', a file must be uploaded.
    body('loanType').custom((value, { req }) => {
        if (value === 'Takeover' && !req.file) {
            throw new Error('A loan document is required for Takeover loans.');
        }
        return true; // Indicates the validation passed
    })
];

// --- Authentication Middleware ---
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next(); // User is authenticated, proceed
    } else {
        // User is not authenticated, redirect to login page
        res.redirect('/login.html');
    }
};

// --- Public Routes ---
// Serve the login page publicly
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));

// --- API Route for Form Submission ---
// The form has a file input with name="loanDocument"
app.post(
    '/api/submit-loan-application', 
    upload.single('loanDocument'), 
    loanApplicationValidationRules, // Apply our validation rules as middleware
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If there are validation errors, collect them and send a 400 Bad Request response
            const errorMessages = errors.array().map(err => err.msg).join(' ');
            return res.status(400).json({ success: false, message: errorMessages });
        }

        try {
            const formData = { ...req.body, loanDocumentPath: req.file ? req.file.path : null };
            // appendToExcel(formData); // Excel file handling removed
            sendNotificationEmail(formData, req.file); // Send notification (with attachment) to you
            sendAutoReplyEmail(formData);    // Send auto-reply to the user
            res.status(200).json({ success: true, message: 'Form submitted successfully!' });
        } catch (error) {
            console.error('Error processing form:', error);
            res.status(500).json({ success: false, message: 'Server error. Please try again.' });
        }
    }
);

// --- Admin Login/Logout API Routes ---
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAuthenticated = true;
        res.status(200).json({ success: true, message: 'Login successful.' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid password.' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Could not log out.' });
        }
        res.clearCookie('connect.sid'); // The default session cookie name
        res.status(200).json({ success: true, message: 'Logged out successfully.' });
    });
});

// --- Protected Admin Routes ---
// Serve the admin page only if authenticated
app.get('/admin.html', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});


// Excel download route removed

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`To view the site, open: http://localhost:${port}/index.html`);
});