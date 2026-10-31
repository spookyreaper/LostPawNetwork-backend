const { authenticatedUser, isOwner, httpError, handleError } = require('../../lib/report-validation');

module.exports = async function (req, res, next) {
  try {
    const userId = authenticatedUser(req);
    const report = await Report.findOne({ id: req.params.id });
    if (!report) {
      throw httpError(404, 'Report not found');
    }
    if (!isOwner(report, userId)) {
      throw httpError(403, 'You are not authorized to modify this report');
    }
    req.report = report;
    return next();
  } catch (error) {
    return handleError(res, error);
  }
};
