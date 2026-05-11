const roleMiddleware=(...allowedRoles)=>{
    return (req,res,next)=>{
        try{
            const userRole=req.user.role;
            if(!allowedRoles.includes(userRole)){
                return res.status(403).send("Access denied");
            }
            next();
        }catch(err){
            return res.status(500).send(err.message);
        };
    };
};

module.exports=roleMiddleware;