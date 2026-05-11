const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = async(req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).send("No token provided");
        }

        const token = authHeader.split(" ")[1];
        

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

const user = await User.findById(decoded.userId);

if (!user) {
    return res.status(404).send("User not found");
}

if (user.isActive === false) {
    return res.status(403).send("Your account has been removed");
}

req.user = decoded;

next();
    } catch (err) {
        return res.status(401).send("Invalid token");
    }
};

module.exports = authMiddleware;