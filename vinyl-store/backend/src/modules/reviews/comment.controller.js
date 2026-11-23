const commentService = require('./comment.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//POST /api/products/:id/comments
async function create(req, res, next) {
  try {
    //req.params.id is already a number and content is trimmed, the validate middleware did it
    const comment = await commentService.createComment(
      req.user.id,
      req.params.id,
      req.body.content
    );
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

//GET /api/products/:id/comments
async function listApproved(req, res, next) {
  try {
    const comments = await commentService.listApprovedComments(req.params.id);
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
}

//GET /api/comments/pending
async function listPending(req, res, next) {
  try {
    const comments = await commentService.listPendingComments();
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
}

//PATCH /api/comments/:id
async function review(req, res, next) {
  try {
    //req.params.id is already a number and status is APPROVED or REJECTED, validate checked them
    const comment = await commentService.reviewComment(req.params.id, req.body.status);
    res.status(200).json(comment);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, listApproved, listPending, review };
