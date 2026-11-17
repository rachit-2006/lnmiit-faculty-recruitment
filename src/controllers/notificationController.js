// Notifications Controller
const recruitmentService = require('../services/recruitmentService');

async function getNotifications(req, res, next) {
  try {
    const userId = req.user ? req.user.userId : req.query.userId;
    const list = recruitmentService.getNotifications(userId);
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotifications
};
