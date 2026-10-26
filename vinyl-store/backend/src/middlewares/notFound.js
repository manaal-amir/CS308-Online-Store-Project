//runs when no route matched the request, e.g. GET /api/blah
//it creates a 404 error and passes it to the error handler so the response stays { error: '...' }
function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

module.exports = notFound;