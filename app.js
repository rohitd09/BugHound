const express = require('express');
const path = require('path');
const bodyParser = require("body-parser");
const flash = require("connect-flash");
const multer = require("multer")
const session = require('express-session');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static("./app/public"));
app.use(express.json());
app.use(flash())

app.use(session({
  secret: 'your secret key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: !true } 
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use((req, res, next)=>{
    res.locals.error = req.flash('error')
    res.locals.success = req.flash('success')
    if(req.query._method == 'DELETE'){
      req.method = "DELETE"
      req.url = req.path
    } else if(req.query._method == 'PUT'){
      req.method = "PUT"
      req.url = req.path
    }
    next()
})

app.get("/", (req, res) => {
    res.render("home", { uname: "" });
})

app.post("/", (req, res) => {
    const { uname } = req.body;
    res.render("home", { uname: uname })
    
    // res.redirect("/")
})

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});