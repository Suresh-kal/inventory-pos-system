const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!user.isVerified) {
      return res.status(403).send("Please verify your email first");
    }

    next();
  } catch (err) {
    res.status(500).send(err.message);
  }
};