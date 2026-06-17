module.exports = { csrfMiddleware: (req, res, next) => next(), csrfTokenRoute: (req, res) => res.json({ csrfToken: 'placeholder' }) };
