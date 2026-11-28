const genreService = require('./genre.service');

//reads the request, calls the service, and sends the result
//errors go to next(err) so the error handler formats them

//POST /api/genres
async function create(req, res, next) {
  try {
    //name and description are already trimmed, the validate middleware did it
    const genre = await genreService.createGenre(req.body);
    res.status(201).json(genre);
  } catch (err) {
    next(err);
  }
}

//DELETE /api/genres/:id
async function remove(req, res, next) {
  try {
    //req.params.id is already a number, the validate middleware did it
    const result = await genreService.deleteGenre(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, remove };
