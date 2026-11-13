const statusService = require('./status.service');

async function updateStatus(req, res, next) {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    const updated = await statusService.updateStatus(orderId, status);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { updateStatus };