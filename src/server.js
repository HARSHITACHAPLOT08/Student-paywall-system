require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const mongoose = require('mongoose');

const AccessPass = require('./accessPassModel');
const { getAllAssignments } = require('./store');
const uploadRouter = require('./uploadRoutes');
const fileRouter = require('./fileRoutes');
const { requireAuth, requireOwner } = require('./sessionMiddleware');
const { SUBJECTS, THEORY_SUBJECTS, LAB_SUBJECTS } = require('./subjects');

const app = express();

// Security & performance middlewares
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "img-src": ["'self'", 'data:', 'https://*'],
      "script-src": ["'self'", 'https://checkout.razorpay.com'],
      "style-src": ["'self'", "'unsafe-inline'"],
      "font-src": ["'self'", 'https://fonts.gstatic.com', 'data:'],
      "connect-src": ["'self'", 'https://api.razorpay.com'],
      "frame-src": ["'self'", 'https://api.razorpay.com', 'https://*.razorpay.com'],
    }
  }
}));
app.use(compression());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

// Sessions
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('SESSION_SECRET is not set. Define it in your environment variables.');
  process.exit(1);
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 60 * 1000, // 30 minutes
    },
  })
);

app.use((req, res, next) => {
  if (req.session) {
    req.session.nowInMinutes = Math.floor(Date.now() / 60000);
  }
  next();
});

app.use(flash());

// Expose session + flash to views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.isOwner = req.session.user?.role === 'owner';
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success'),
  };
  next();
});

// Razorpay setup (₹5 fixed payment)
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  console.log('Razorpay configured and enabled.');
} else {
  console.log('Razorpay NOT configured (missing key id/secret). Payments will be disabled.');
}

// Constants for access control
const OWNER_PASSCODE = process.env.OWNER_PASSCODE;
if (!OWNER_PASSCODE) {
  console.error('OWNER_PASSCODE is not set. Define it in your environment variables.');
  process.exit(1);
}

// Landing / login
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', {
    title: 'Assignment Vault | Secure Entrance',
    razorpayKeyId: RAZORPAY_KEY_ID || null,
  });
});

// Owner-only manual login preserved for admin (no UI form by default)
app.post('/login', (req, res) => {
  const { studentName, passcode } = req.body;

  if (!studentName || !passcode) {
    req.flash('error', 'Please enter both name and passcode.');
    return res.redirect('/');
  }

  let role = null;
  if (passcode === OWNER_PASSCODE) {
    role = 'owner';
  }

  if (!role) {
    req.flash('error', 'Access denied: Invalid owner passcode');
    return res.redirect('/');
  }

  req.session.user = {
    name: studentName.trim(),
    role,
    loggedInAt: Date.now(),
  };

  res.redirect('/dashboard');
});

// Shared handler to create a Razorpay order for ₹5
async function handleCreateOrder(req, res) {
  try {
    const { studentName, contact } = req.body;
    if (!studentName || typeof studentName !== 'string' || !studentName.trim()) {
      return res.status(400).json({ error: 'Student name is required' });
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !razorpay) {
      return res.status(500).json({ error: 'Payment gateway is not configured' });
    }

    const amount = 5 * 100; // ₹5 in paise

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      payment_capture: 1,
      notes: {
        studentName: studentName.trim(),
      },
    });

    await AccessPass.create({
      studentName: studentName.trim(),
      contact: contact || undefined,
      razorpayOrderId: order.id,
      amount,
      currency: 'INR',
    });

    return res.json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount,
      currency: 'INR',
      studentName: studentName.trim(),
    });
  } catch (err) {
    console.error('Error creating Razorpay order', err);
    const message =
      (err && err.error && err.error.description) ||
      err.message ||
      'Unable to initiate payment';
    return res.status(500).json({ error: message });
  }
}

// Primary API used by frontend JS
app.post('/api/payment/order', handleCreateOrder);
// Alternate route for compatibility with deployment expectations
app.post('/create-order', handleCreateOrder);

// API: verify Razorpay payment and generate one-time passcode (no login yet)
app.post('/api/payment/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Incomplete payment details' });
    }

    if (!RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Payment gateway is not configured' });
    }

    const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + '|' + razorpay_payment_id);
    const expectedSignature = hmac.digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const pass = await AccessPass.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!pass) {
      return res.status(404).json({ error: 'Access record not found' });
    }

    // Ensure this order has not already been finalized with a different passcode
    if (pass.used) {
      return res.status(400).json({ error: 'This passcode has already been used for login' });
    }

    // Generate or reuse a one-time passcode after successful payment verification
    if (!pass.passcode) {
      pass.passcode = crypto.randomBytes(3).toString('hex').toUpperCase();
      pass.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from verification
    }

    pass.razorpayPaymentId = razorpay_payment_id;
    pass.razorpaySignature = razorpay_signature;
    await pass.save();

    return res.json({
      success: true,
      passcode: pass.passcode,
      expiresAt: pass.expiresAt,
    });
  } catch (err) {
    console.error('Error verifying Razorpay payment', err);
    return res.status(500).json({ error: 'Unable to verify payment' });
  }
});

// Passcode-based viewer login after payment
app.post('/login/passcode', async (req, res) => {
  try {
    const { studentName, passcode } = req.body;

    if (!studentName || !passcode) {
      req.flash('error', 'Please enter both name and passcode.');
      return res.redirect('/');
    }

    const pass = await AccessPass.findOne({
      studentName: studentName.trim(),
      passcode: passcode.trim().toUpperCase(),
    });
    if (!pass) {
      req.flash('error', 'Invalid passcode or name.');
      return res.redirect('/');
    }

    if (!pass.razorpayPaymentId) {
      req.flash('error', 'Payment verification not completed for this passcode.');
      return res.redirect('/');
    }

    if (pass.used) {
      req.flash('error', 'This passcode has already been used.');
      return res.redirect('/');
    }

    if (pass.expiresAt && pass.expiresAt.getTime() < Date.now()) {
      req.flash('error', 'This passcode has expired.');
      return res.redirect('/');
    }

    pass.used = true;
    await pass.save();

    req.session.user = {
      name: pass.studentName,
      role: 'viewer',
      loggedInAt: Date.now(),
      passcode: pass.passcode,
    };

    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Error during passcode login', err);
    req.flash('error', 'Unable to complete login with passcode right now.');
    return res.redirect('/');
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Dashboard
app.get('/dashboard', requireAuth, async (req, res) => {
  const assignments = await getAllAssignments();

  const recentAssignments = [...assignments]
    .sort((a, b) => b.uploadedAt - a.uploadedAt)
    .slice(0, 6);

  res.render('dashboard', {
    title: 'Assignment Vault | Dashboard',
    subjects: SUBJECTS,
    theorySubjects: THEORY_SUBJECTS,
    labSubjects: LAB_SUBJECTS,
    assignments,
    recentAssignments,
  });
});

// Owner-only access log for payments / passes
app.get('/admin/access-log', requireOwner, async (req, res) => {
  try {
    const passes = await AccessPass.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.render('access-log', {
      title: 'Assignment Vault | Access Log',
      passes,
    });
  } catch (err) {
    console.error('Error loading access log', err);
    req.flash('error', 'Unable to load access log right now.');
    res.redirect('/dashboard');
  }
});

// API for search/filter
app.get('/api/assignments', requireAuth, async (req, res) => {
  const { q, subject, type } = req.query;
  const all = await getAllAssignments();

  let filtered = all;
  if (subject) {
    filtered = filtered.filter((a) => a.subjectSlug === subject);
  }
  if (type) {
    filtered = filtered.filter((a) => a.fileType === type);
  }
  if (q) {
    const term = q.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(term) ||
        (a.description && a.description.toLowerCase().includes(term))
    );
  }

  res.json({ assignments: filtered });
});

// Upload & management (owner only for mutating routes)
app.use('/', uploadRouter);
// File preview/download
app.use('/', fileRouter);

// Privacy policy page
app.get('/privacy', (req, res) => {
  res.render('privacy', { title: 'Assignment Vault | Privacy Policy' });
});

// 404 handler
app.use((req, res) => {
  if (req.accepts('html')) {
    return res.status(404).render('404', { title: 'Not Found' });
  }
  return res.status(404).json({ error: 'Not found' });
});

// Start server after MongoDB is connected
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Define it in your environment variables.');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected');
    app.listen(PORT, () => {
      console.log(`Assignment Vault running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB Error:', err);
    process.exit(1);
  });
