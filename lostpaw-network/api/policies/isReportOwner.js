module.exports = async function(req, res, next) {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'You must be logged in to perform this action' });
    }
  
    const report = await Report.findOne({ id: req.params.id });
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
  
    if (report.user !== req.session.userId) {
      return res.status(403).json({ error: 'You are not authorized to update this report' });
    }
  
    return next();
  };
  