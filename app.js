const express = require('express');
const bodyParser = require("body-parser");
const mysql = require("mysql");
const bcrypt = require("bcryptjs");
const session = require('express-session');
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const flash = require("connect-flash");
const multer = require("multer")
const path = require('path');
const cookie = require("cookie-parser");

const dotenv = require("dotenv").config();

const app = express();

const port = 3000;

const connection = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
  connectionLimit: 10
})

connection.connect(err => {
  if (err) throw err;
  console.log("Connected to MySQL Server Successfully!");
})

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: !true } 
}));

app.use(flash());
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, (email, password, done) => {
  connection.query('SELECT * FROM User WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error("Error during database query:", err);
      return done(err);
    }
    if (!results || results.length === 0) {
      return done(null, false, { message: "No User Found" });
    }

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error("Error during password comparison:", err);
        return done(err);
      }
      if (isMatch) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Password incorrect" });
      }
    });
  });
}));



passport.serializeUser((user, done) => {
  console.log("Serializing user:", user);
  done(null, user.user_id);
})

passport.deserializeUser((id, done) => {
  connection.query('SELECT * FROM User WHERE user_id = ?', [id], (err, results) => {
    if (err) {
      console.error("Error during user deserialization:", err);
      return done(err);
    }
    if (!results || results.length === 0) {
      return done(new Error('User not found'));
    }
    done(null, results[0]);
  });
});


app.use("/js", express.static(__dirname + '/public/js'));
app.use("/css", express.static(__dirname + '/public/css'));
app.use(express.static("./app/public"));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use((req, res, next)=>{
  res.locals.currentUser = req.user
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

app.get('/bugreport', (req, res) => {
  res.render('bugreports/bugreport'); 
});

app.get('/addEmployee', (req, res) => {
  res.render('admin/employee/addEmployee');
});

app.post("/add-employee", (req, res) => {
  let { fname, mname, lname, address, dob, email, password, userlevel } = req.body;

  bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
          console.error("Error hashing password:", err);
          return res.status(500).send("Server error");
      }
      connection.query('INSERT INTO User (first_name, middle_name, last_name, address, email, password, user_level, DOB) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [fname, mname, lname, address, email, hash, userlevel, dob], (err, result) => {
          if (err) {
              console.error("Error inserting user into database:", err);
              return res.status(500).send("Database error");
          }
          res.redirect("/admin");
      });
  });
});

app.get('/viewEmployees', (req, res) => {
  connection.query('SELECT * FROM User', (err, users) => {
    if (err) {
      console.log(err);
      return done(err);
    } else {
      res.render('admin/employee/view_employee', {users: users})
    }
  })
})

app.get('/editEmployee/:id', (req, res) => {
  const id = req.params.id; // Corrected: directly assigning `req.params.id` to `id`

  connection.query('SELECT * FROM User WHERE user_id = ?', [id], (err, results) => {
    if (err) {
      console.error(err); // Use console.error for errors
      res.status(500).send('Database error'); // Handle the error properly in the response
    } else {
      if (results.length > 0) {
        res.render('admin/employee/edit_employee', { user: results[0] }); // Pass only the first result if the user is found
      } else {
        res.status(404).send('User not found'); // Handle the case where no user is found
      }
    }
  });
});

app.post("/editEmployee", (req, res) => {
  let { user_id, fname, mname, lname, address, dob, email, password, userlevel } = req.body;

  bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
          console.error("Error hashing password:", err);
          req.flash("error", "Employee could not be edited!")
          res.redirect("/admin")
      }
      connection.query('Update User Set first_name = ?, middle_name = ?, last_name = ?, address = ?, email = ?, password = ?, user_level = ?, DOB = ? Where user_id = ?', [fname, mname, lname, address, email, hash, userlevel, dob, user_id], (err, result) => {
          if (err) {
              console.error("Error inserting user into database:", err);
              req.flash("error", "Employee could not be edited!")
              res.redirect("/admin")
          }
          req.flash("success", "Employee Details Edited Succesfully!")
          res.redirect("/admin");
      });
  });
});

app.get('/addProgram', (req, res) => {
   res.render('admin/program/addProgram')
})

app.get('/admin', (req, res) => {
   res.render('admin/admin');
});

app.get("/login", (req, res) => {
   res.render("login");
})   
 
app.get("/", (req, res) => {
   res.render("home");
})

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true,
  successFlash: true
}));

app.get("/logout", (req, res) => {
  req.logout((err) => {
      if (err) {
          console.error('Logout error:', err);
          return next(err);
      }
      res.redirect("/");
  });
});


app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
});