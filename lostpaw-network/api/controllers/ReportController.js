const ReportController = {
  // Create a new report
  create: async function(req, res) {
    try {
      const newReport = await Report.create(req.body).fetch();
      return res.status(201).json({ message: 'Report created successfully', report: newReport });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve a specific report by ID
  findOne: async function(req, res) {
    try {
      const report = await Report.findOne({ id: req.params.id }).populate('pet').populate('user');
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.json(report);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve all reports
  find: async function(req, res) {
    try {
      const reports = await Report.find().populate('pet').populate('user');
      return res.json(reports);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve lost reports by category
  findLostByCategory: async function(req, res) {
    const { category } = req.params;
    try {
      const lostReports = await Report.find({ type: 'lost', category }).populate('pet');
      return res.json(lostReports);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Update a report by ID
  update: async function(req, res) {
    try {
      const updatedReport = await Report.updateOne({ id: req.params.id }).set(req.body);
      if (!updatedReport) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.json({ message: 'Report updated successfully', report: updatedReport });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Delete a report by ID
  destroy: async function(req, res) {
    try {
      const deletedReport = await Report.destroyOne({ id: req.params.id });
      if (!deletedReport) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};

module.exports = ReportController;
