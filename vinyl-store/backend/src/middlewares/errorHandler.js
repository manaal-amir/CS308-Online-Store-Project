function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}
module.exports = errorHandler;

//Placeholder, Ayesha replace with your own error handling logic 