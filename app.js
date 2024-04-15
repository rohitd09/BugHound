const express = require('express');
const bodyParser = require("body-parser");
const methodOverride = require('method-override');
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

const middleware = require('./middleware');
const { pid } = require('process');

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
app.use(methodOverride('_method'));

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
      return done(null, false, { message: "Incorrect Password or Username!" });
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
        return done(null, false, { message: "Incorrect Password or Username!" });
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

app.get('/bugreport', middleware.isLoggedIn, (req, res) => {
  res.render('bugreports/bugreport'); 
});

app.post('/bugreport', (req, res) => {
  res.redirect('/')
})

app.get('/addEmployee', middleware.isLevelThree, (req, res) => {
  res.render('admin/employee/add_employee');
});

app.post("/addEmployee", middleware.isLevelThree, (req, res) => {
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
          req.flash("success", "Employee Details Added Successfully!")
          res.redirect("/admin");
      });
  });
});

app.get('/viewEmployees', middleware.isLevelThree, (req, res) => {
  connection.query('SELECT * FROM User', (err, users) => {
    if (err) {
      console.log(err);
      return done(err);
    } else {
      res.render('admin/employee/view_employee', {users: users})
    }
  })
})

app.get('/editEmployee/:id', middleware.isLevelThree, (req, res) => {
  const id = req.params.id; 

  connection.query('SELECT * FROM User WHERE user_id = ?', [id], (err, results) => {
    if (err) {
      console.error(err); 
      res.status(500).send('Database error'); 
    } else {
      if (results.length > 0) {
        res.render('admin/employee/edit_employee', { user: results[0] }); 
      } else {
        res.status(404).send('User not found');
      }
    }
  });
});

app.put("/editEmployee/:id", middleware.isLevelThree, (req, res) => {
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

app.delete("/deleteEmployee/:id", middleware.isLevelThree, (req, res) => {
    const id = req.params.id;

    connection.query('Delete From User Where user_id = ?', [id], (err, result) => {
      if (err) {
        console.log("Error deleting from the database:", err);
        req.flash("error", "Employee could not be deleted!")
        res.redirect("/admin")
      }
      req.flash("success", "Employee Details Deleted Successfully!")
      res.redirect("/admin")
    });
});

app.get('/addProgram', middleware.isLevelThree, (req, res) => {
   res.render('admin/program/add_program')
})

app.post('/addProgram', middleware.isLevelThree, (req, res) => {
    let { pName, pCategory, pVersion, pSummary } = req.body;
    connection.query('Insert Into Program (program_name, program_category, program_version, program_summary) Values (?, ?, ?, ?)', [pName, pCategory, pVersion, pSummary], (err, result) => {
      if(err){
        console.log(err);
        return res.status(500).send("Error Status 500! Database Error!");
      }
      req.flash("success", "Program Details Added Successfully!");
      res.redirect("/admin");
    });
});

app.get('/viewPrograms', middleware.isLevelThree, (req, res) => {
  connection.query('SELECT * FROM Program', (err, programs) => {
    if (err) {
      console.log(err);
      return done(err);
    } else {
      res.render('admin/program/view_program', {programs: programs})
    }
  });
});

app.get('/editProgram/:id', middleware.isLevelThree, (req, res) => {
  const id = req.params.id; 

  connection.query('SELECT * FROM Program WHERE program_id = ?', [id], (err, results) => {
    if (err) {
      console.error(err); 
      res.status(500).send('Database error'); 
    } else {
      if (results.length > 0) {
        res.render('admin/program/edit_program', { program: results[0] }); 
      } else {
        res.status(404).send('Program not found');
      }
    }
  });
});

app.put("/editProgram/:id", middleware.isLevelThree, (req, res) => {
  let { pId, pName, pCategory, pVersion, pSummary } = req.body;

  connection.query('Update Program Set program_name = ?, program_category = ?, program_version = ?, program_summary = ? Where program_id = ?', [pName, pCategory, pVersion, pSummary, pId], (err, result) => {
      if (err) {
          console.error("Error inserting user into database:", err);
          req.flash("error", "Program could not be edited!")
          res.redirect("/admin")
      }
      req.flash("success", "Program Details Edited Succesfully!")
      res.redirect("/admin");
  });
});

app.delete("/deleteProgram/:id", middleware.isLevelThree, (req, res) => {
    const id = req.params.id;

    connection.query('Delete From Program Where program_id = ?', [id], (err, result) => {
      if (err) {
        console.log("Error deleting from the database:", err);
        req.flash("error", "Program could not be deleted!")
        res.redirect("/admin")
      }
      req.flash("success", "Program Details Deleted Successfully!")
      res.redirect("/admin")
    });
});


app.get('/admin', middleware.isLevelThree, (req, res) => {
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