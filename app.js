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

const { createPool } = require('mysql')

const pool = createPool({
    host: "localhost",
    user: "root",
    password: "2000",
    database: "BugHound",
    connectionLimit: 10
})

pool.query("select * from test", (err, result, fields) => {
    if (err){
        console.log(err);
    } else {
        console.log(result);
    }
})

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


app.post('/start_page', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  //const hashedPassword = crypto.createHash('sha512').update(password).digest('hex').substr(0, 32);

  const query = 'SELECT * FROM employees WHERE username = ? AND password = ?';
  conn.query(query, [username, hashedPassword], (err, results) => {
      if (err) {
          console.error('SQL query error:', err);
          return res.redirect('/');
      }

      if (results.length > 0) {
          req.session.username = results[0].username;
          req.session.userlevel = results[0].userlevel;
          res.redirect('/start_page');
      } else {
          req.session.destroy(() => {
              res.redirect('/');
          });
      }
  });
});


app.get('/start_page', (req, res) => {
  if (req.session.username && req.session.userlevel) {
      res.render('start_page', {
          username: req.session.username,
          userlevel: req.session.userlevel
      });
  } else {
      res.redirect('/');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
      res.redirect('/');
  });
});


//app.get('/bugreport', (req, res) => {
//  res.render('bugreport'); 
//});


app.get('/bugreport', (req, res) => {
  req.session.destroy(() => {
      res.render('bugreport'); 
  });
});

app.get('/addEmployee', (req, res) => {
  res.render('addEmployee');
});

app.post('/addEmployee', (req, res) => {
  const { name, username, password, userlevel } = req.body;
  // Perform server-side validation and other processing here
  console.log('Form submitted with data:', req.body);
  res.send('Employee added successfully'); 
});

app.route('/addProgram')
  .get((req, res) => {
      // Display the form by rendering the same EJS file without form data
      res.render('addProgram', { formData: null });
  })
  .post((req, res) => {
      // After form submission, render the EJS file with form data to display the success message
      res.render('addProgram', { formData: req.body });
  });


  app.get('/admin', (req, res) => {
    res.render('admin');
  });
  
  app.get('/admin2', (req, res) => {
    res.render('admin2');
  });
  

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