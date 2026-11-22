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

module.exports = { create };
