//prisma error codes that are the user's fault, not a server problem
//P2002: a unique field already exists (e.g. two sign ups with the same email at the same moment)
//P2025: the record to update or delete was not found
const PRISMA_CLIENT_ERRORS = {
  P2002: { status: 409, message: 'This record already exists' },
  P2025: { status: 404, message: 'Record not found' },
};

//turns known library errors into a clear status and message, returns null for anything else
function knownError(err) {
  //express.json() could not read the request body because it is not valid json
  if (err.type === 'entity.parse.failed') {
    return { status: 400, message: 'Invalid JSON body' };
  }
  //prisma errors carry a code like P2002
  if (typeof err.code === 'string' && PRISMA_CLIENT_ERRORS[err.code]) {
    return PRISMA_CLIENT_ERRORS[err.code];
  }
  return null;
}

//central error handler, express sends any error passed to next(err) here
//it must have 4 parameters (err, req, res, next) or express won't treat it as an error handler
function errorHandler(err, req, res, next) {
  //if a response was already started, express must handle it (it closes the connection)
  if (res.headersSent) {
    return next(err);
  }

  //known library errors get a fixed status and a safe message instead of their raw text
  const known = knownError(err);
  if (known) {
    return res.status(known.status).json({ error: known.message });
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