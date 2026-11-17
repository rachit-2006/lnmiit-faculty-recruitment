// Appointment Letter Controller (UC-013, FR-029)
const recruitmentService = require('../services/recruitmentService');

async function generateAppointmentLetter(req, res, next) {
  try {
    const applicationId = req.params.applicationId || req.params.id;
    const rcUserId = req.user.userId;

    const letter = recruitmentService.generateAppointmentLetter(rcUserId, applicationId);
    res.status(201).json(letter);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateAppointmentLetter
};
