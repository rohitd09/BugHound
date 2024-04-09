const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const session = require('express-session');
const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'your secret key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: !true } 
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.get("/", (req, res) => {
    res.render("home", { uname: "" });
})

app.post("/", (req, res) => {
    const { uname } = req.params;
    res.render("home", { uname: uname })
    
    // res.redirect("/")
})

app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});