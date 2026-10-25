//central error handler, express sends any error passed to next(err) here
//it must have 4 parameters (err, req, res, next) or express won't treat it as an error handler
function errorHandler(err, req, res, next) {
  //if a response was already started, express must handle it (it closes the connection)
  if (res.headersSent) {
    return next(err);
  }

  //some libraries use statusCode instead of status, so check both
  let status = err.status || err.statusCode || 500;

  //only accept real error codes (400 to 599), anything else is treated as a server error
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }

  //server errors (500 and above) may contain internal details like db info
  if (status >= 500) {
    //log the full error on the server so the team can debug it
    console.error(err);
    //send a generic message so internal details are never shown to the user
    return res.status(status).json({ error: 'Internal server error' });
  }

  //client errors (400s) are safe to show, use a fallback if the message is empty
  res.status(status).json({ error: err.message || 'Request failed' });
}

//export so app.js can register it as the last middleware
module.exports = errorHandler;