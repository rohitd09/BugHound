var middlewareObj = {};

middlewareObj.isLoggedIn = function(req, res, next) {
    if (req.isAuthenticated()){
        return next();
    } else {
        req.flash("error", "You need to be Logged in to proceed!");
        return res.redirect("/login");
    }
}

middlewareObj.isLevelThree = function(req, res, next) {
    if(req.isAuthenticated()){
        if(req.user.user_level === '3') {
            return next();
        } else {
            console.log(req.user.user_level);
            res.redirect("/");
        }
    } else {
        res.redirect("/");
    }
}

middlewareObj.isLevelTwo = function(req, res, next) {
    if(req.isAuthenticated()){
        if(req.user.user_level === '2' || req.user.user_level === '3') {
            return next();
        } else {
            console.log(req.user.user_level);
            req.flash("Oops! Something Went Wrong!");
            res.redirect("/");
        }
    } else {
        res.redirect("/");
    }
}

module.exports = middlewareObj;