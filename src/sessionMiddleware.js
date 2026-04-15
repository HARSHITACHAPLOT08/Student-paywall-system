function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/');
  }
  next();
}

function requireOwner(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'owner') {
    if (req.accepts('html')) {
      req.flash('error', 'Owner access required for this action.');
      return res.redirect('/dashboard');
    }
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
}

function requirePaid(req, res, next) {
  // Owners always allowed
  if (req.session && req.session.user && req.session.user.role === 'owner') {
    return next();
  }

  if (!req.session || !req.session.user) {
    if (req.accepts('html')) {
      req.flash('error', 'Please login to access this resource.');
      return res.redirect('/');
    }
    return res.status(403).json({ error: 'Authentication required' });
  }

  const isPaid = req.session.isPaid === true;
  const expiresAt = req.session.expiry || 0;
  if (!isPaid || Date.now() > expiresAt) {
    if (req.accepts('html')) {
      req.flash('error', 'Paid access required to view this file.');
      return res.redirect('/dashboard');
    }
    return res.status(403).json({ error: 'Paid access required' });
  }

  next();
}

module.exports = { requireAuth, requireOwner, requirePaid };
