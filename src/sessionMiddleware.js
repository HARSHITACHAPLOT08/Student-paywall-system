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

module.exports = { requireAuth, requireOwner };
