// Vacancy Controller
const recruitmentService = require('../services/recruitmentService');

async function listVacancies(req, res, next) {
  try {
    const list = recruitmentService.getVacancies(req.query);
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
}

async function getVacancy(req, res, next) {
  try {
    const v = recruitmentService.getVacancy(req.params.vacancyId);
    if (!v) {
      return res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Vacancy not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }
    res.status(200).json(v);
  } catch (err) {
    next(err);
  }
}

async function createVacancy(req, res, next) {
  try {
    const created = recruitmentService.createVacancy(req.body, req.user.userId);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVacancies,
  getVacancy,
  createVacancy
};
