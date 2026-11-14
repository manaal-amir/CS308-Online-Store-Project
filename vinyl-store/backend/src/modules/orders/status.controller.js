const statusService = require('./status.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them
//PATCH /api/orders/:id/status
async function updateStatus(req, res, next) {
  try {
    //req.params.id is already a number, the validate middleware converted it
    const updated = await statusService.updateStatus(req.params.id, req.body.status);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = { updateStatus };
