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
const xml2js = require('xml2js');
const builder = new xml2js.Builder();

const dotenv = require("dotenv").config();

const app = express();

const middleware = require('./middleware');
const { pid } = require('process');
const { error, log } = require('console');
const { connect } = require('http2');

const port = 3000;

const connection = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE
})

connection.connect(err => {
  if (err) throw err;
  console.log("Connected to MySQL Server Successfully!");
})

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
      cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

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
  connection.query('Select * From User', (err, employees) => {
    if(err) {
      console.error(err);
      return res.status(500).send("Server Error 500: Cannot fetch employee data");
    }
    connection.query('Select * From Program', (err, programs) => {
      if(err){
        console.error(err);
        return res.status(500).send("Server Error 500: Cannot fetch program data");
      }
      res.render("bugreports/bugreport", { employees: employees, programs: programs })
    })
  })
});

app.post('/bugreport', middleware.isLoggedIn, upload.single('attachment'), (req, res) => {
   let {program,
        report_type,
        severity,
        problem_summary,
        problem,
        suggested_fix,
        reported_by,
        report_date,
        reproducible,
        functional_area,
        assigned_to,
        comments,
        status,
        priority,
        resolution,
        resolution_version,
        resolved_by,
        resolved_date,
        tested_by,
        test_date,
        treat_as_deferred} = req.body;

        if (resolved_date == ''){
          resolved_date = null
        }

        if (test_date == ''){
          test_date = null
        }

        if(reproducible == null){
          reproducible = 'off'
        }

        const filename = req.file ? req.file.filename : null;

        connection.query('INSERT INTO Report (program, report_type, severity, problem_summary, problem, suggested_fix, reported_by, date, reproducible, functional_area, assigned_to, comments, status, priority, resolution, resolution_version, resolved_by, resolved_date, tested_by, test_date, treat_as_deferred, attachment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            Number(program),
            report_type,
            severity,
            problem_summary,
            problem,
            suggested_fix,
            Number(reported_by),
            report_date,
            reproducible,
            functional_area,
            assigned_to ? Number(assigned_to) : null, 
            comments,
            status,
            priority,
            resolution,
            resolution_version,
            resolved_by ? Number(resolved_by) : null, 
            resolved_date,
            tested_by ? Number(tested_by) : null,
            test_date,
            treat_as_deferred,
            filename
        ], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Server Error: 500, Could not insert to database!');
            }
            req.flash("success", "Bug Reported Successfully!");
            res.redirect("/");
        });

})

app.get('/viewReport', middleware.isLoggedIn, (req, res) => {
  const sql = `
      SELECT 
          r.report_id,
          p.program_name,
          r.report_type,
          r.severity,
          r.problem_summary,
          r.problem,
          r.suggested_fix,
          r.date,
          r.reproducible,
          r.functional_area,
          r.comments,
          r.status,
          r.priority,
          r.resolution,
          r.resolution_version,
          r.resolved_date,
          r.test_date,
          r.treat_as_deferred,
          reported.first_name AS reported_by_first_name,
          reported.last_name AS reported_by_last_name,
          assigned.first_name AS assigned_to_first_name,
          assigned.last_name AS assigned_to_last_name,
          resolved.first_name AS resolved_by_first_name,
          resolved.last_name AS resolved_by_last_name,
          tested.first_name AS tested_by_first_name,
          tested.last_name AS tested_by_last_name
      FROM 
          Report r
      JOIN 
          Program p ON r.program = p.program_id
      LEFT JOIN 
          User reported ON r.reported_by = reported.user_id
      LEFT JOIN 
          User assigned ON r.assigned_to = assigned.user_id
      LEFT JOIN 
          User resolved ON r.resolved_by = resolved.user_id
      LEFT JOIN 
          User tested ON r.tested_by = tested.user_id
  `;

  connection.query(sql, (err, reports) => {
      if (err) {
          console.error(err);
          return res.status(500).send('Server Error 500: Cannot fetch Bug Reports');
      }
      res.render("bugreports/view_bugreport", { reports: reports });
  });
});

app.get('/editReport/:id', middleware.isLevelTwo, (req, res) => {
  const { id } = req.params;
  connection.query('Select * From Program', (errP, programs) => {
    if(errP){
      console.error(errP);
      return res.status(500).send('Server Error: 500 | Cannot fetch programs')
    }
    connection.query('Select * From User', (errU, employees) => {
      if(errU){
        console.error(errU);
        return res.status(500).send('Server Error: 500 | Cannot fetch users')
      }
      connection.query('Select * From Report Where report_id = ?', [id], (err, report) => {
        if(err){
          console.error(err);
          return res.status(500).send('Server Error 500: Cannot Fetch Report')
        }
        console.log(report);
        res.render('bugreports/edit_bugreport', { programs: programs, employees: employees, report: report })
      })
    })
  })
})

app.put('/editReport/:id', middleware.isLevelTwo, upload.single('attachment'), (req, res) => {
  const id = req.params.id;
  let {program,
    report_type,
    severity,
    problem_summary,
    problem,
    suggested_fix,
    reported_by,
    report_date,
    reproducible,
    functional_area,
    assigned_to,
    comments,
    status,
    priority,
    resolution,
    resolution_version,
    resolved_by,
    resolved_date,
    tested_by,
    test_date,
    treat_as_deferred} = req.body;

    if (resolved_date == ''){
      resolved_date = null
    }

    if (test_date == ''){
      test_date = null
    }

    if(reproducible == null){
      reproducible = 'off'
    }

    if(treat_as_deferred == null){
      treat_as_deferred = 'off'
    }

    connection.query('SELECT attachment FROM Report WHERE report_id = ?', [id], (err, rows) => {
      if (err){
        console.error(err);
        return res.status(500).send('Server Error: 500, Could not retrieve existing data!');
      }
      const existingFilename = rows[0].attachment;
      const filename = req.file ? req.file.filename : existingFilename;
      connection.query('Update Report Set program = ?, report_type = ?, severity = ?, problem_summary = ?, problem = ?, suggested_fix = ?, reported_by = ?, date = ?, reproducible = ?, functional_area = ?, assigned_to = ?, comments = ?, status = ?, priority = ?, resolution = ?, resolution_version = ?, resolved_by = ?, resolved_date = ?, tested_by = ?, test_date = ?, treat_as_deferred = ?, attachment = ? Where report_id = ?',
      [
          Number(program),
          report_type,
          severity,
          problem_summary,
          problem,
          suggested_fix,
          Number(reported_by),
          report_date,
          reproducible,
          functional_area,
          assigned_to ? Number(assigned_to) : null, 
          comments,
          status,
          priority,
          resolution,
          resolution_version,
          resolved_by ? Number(resolved_by) : null, 
          resolved_date,
          tested_by ? Number(tested_by) : null,
          test_date,
          treat_as_deferred,
          filename,
          id
      ], (err, result) => {
        if (err) {
          console.error("Database error on update:", err);
          return res.status(500).send('Server Error: Could not update database!');
          } else {
              console.log("Update result:", result);
          }
          req.flash("success", "Edited Bug Report Successfully!");
          res.redirect("/");
      });
    })
})

app.delete('/deleteReport/:id', middleware.isLevelThree, (req, res) => {
  const id = req.params.id;

  connection.query('Delete from Report Where report_id = ?', [id], (err, result) => {
    if(err){
      console.error(err);
      return res.status(500).send('Server Error 500: Report Could not be deleted!')
    }
    req.flash("success", "Report Deleted Successfully!");
    res.redirect("/");
  });
});

app.get('/getXML/:id', middleware.isLoggedIn, (req, res) => {
  const id = req.params.id;

  const query = `SELECT 
    r.report_id,
    p.program_name,
    r.report_type,
    r.severity,
    r.problem_summary,
    r.problem,
    r.suggested_fix,
    CONCAT(u.first_name, ' ', u.last_name) AS reported_by_name,
    r.date,
    r.reproducible,
    r.functional_area,
    CONCAT(au.first_name, ' ', au.last_name) AS assigned_to_name,
    r.comments,
    r.status,
    r.priority,
    r.resolution,
    r.resolution_version,
    CONCAT(resu.first_name, ' ', resu.last_name) AS resolved_by_name,
    r.resolved_date,
    CONCAT(tu.first_name, ' ', tu.last_name) AS tested_by_name,
    r.test_date,
    r.treat_as_deferred
  FROM 
    Report r
  JOIN 
    Program p ON r.program = p.program_id
  JOIN 
    User u ON r.reported_by = u.user_id
  LEFT JOIN 
    User au ON r.assigned_to = au.user_id
  LEFT JOIN 
    User resu ON r.resolved_by = resu.user_id
  LEFT JOIN 
    User tu ON r.tested_by = tu.user_id;
  `; 
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server Error 500: Report could not be fetched!');
    }

    if (results.length === 0) {
      return res.status(404).send('No report found with that ID.');
    }

    const xml = builder.buildObject({ report: results[0] });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename=report.xml');
    
    res.send(xml);
  });
});

app.get('/downloadAttachment/:id', middleware.isLoggedIn, (req, res) => {
  const id = req.params.id;

  connection.query('SELECT attachment FROM Report WHERE report_id = ?', [id], (err, results) => {
    if (err) {
      console.error(err);
      req.flash("error", "Server Error 500: Could not fetch attachments");
      return res.redirect('/viewReport');
    }

    if (results.length === 0 || !results[0].attachment) {
      req.flash("error", "This Report does not have any attachments!");
      return res.redirect('/viewReport');
    }

    const attachmentPath = path.join(__dirname, 'uploads', results[0].attachment);
    res.download(attachmentPath, results[0].attachment, (downloadError) => {
      if (downloadError) {
        console.error(downloadError);
      } else {
        console.log("Attachments downloaded successfully");
      }
    });
  });
});


app.get('/viewReport/:id', (req, res) => {
  const reportId = req.params.id;

  
  const query = 
  `SELECT 
    r.*, 
    p.program_name, 
    a.first_name AS assigned_first_name, a.last_name AS assigned_last_name,
    t.first_name AS tested_first_name, t.last_name AS tested_last_name,
    re.first_name AS resolved_first_name, re.last_name AS resolved_last_name
  FROM Report r
  LEFT JOIN Program p ON r.program = p.program_id
  LEFT JOIN User a ON r.assigned_to = a.user_id
  LEFT JOIN User t ON r.tested_by = t.user_id
  LEFT JOIN User re ON r.resolved_by = re.user_id
  WHERE r.report_id = ?`;


  connection.query(query, [reportId], (err, result) => {
    if (err) {
      console.error("Error fetching report:", err);
      return res.status(500).send("Database error");
    }
    if (result.length > 0) {
      // Pass the report data to the EJS template
      res.render('bugreports/bugReportDetails', { report: result[0] });
    } else {
      res.status(404).send('Report not found');
    }
  });
});













app.get('/addEmployee', (req, res) => {
  res.render('admin/employee/add_employee');
});

app.post("/addEmployee", (req, res) => {
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

app.delete("/deleteEmployee/:user_id/:id", middleware.isLevelThree, (req, res) => {
    const id = req.params.id;
    const user_id = req.params.user_id;

    if(id == user_id){
      req.flash("error", "You cannot delete your own account!")
      return res.redirect("/admin")
    }

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