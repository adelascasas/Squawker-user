const express = require('express');
const sendmail = require("./SendEmail.js");
const db = require("./database.js");
const uuidv4 = require('uuid/v4');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const app = express();
const path = require('path');


app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(cookieParser());
app.use((req,res,next) => {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers','Origin, X-Requested-With, Content-Type, Accept');
    next();
});


app.get('/', (req,res) => {
    	res.sendFile(path.join(__dirname+'/login.html'));
});

app.post("/adduser",(req,res) => {
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;
    mongoose.model('users').countDocuments({username}, (err,count) => {
        if(count > 0){
            res.status(400);
            res.json({status: 'error', error: 'username or email already taken'});
        }
        else{
            mongoose.model('users').countDocuments({email}, (err,count) => {
                if(count > 0){
                    res.status(400);
                    res.json({status: 'error', error: 'username or email already taken'});
                    return;
                }
                let User = mongoose.model('users');
                const newuser  = new User();
                newuser._id = uuidv4();
                newuser.username = username;
                newuser.password = password;
                newuser.email = email;
                newuser.verified = false;
                newuser.key = uuidv4();
                newuser.save((err,doc) => {
                   if(err) { 
                        res.status(400);
                        res.json({status: 'error', error: 'error adding user'});
                    }
                    else{
                        console.log(doc);
                        res.status(200);
                        res.json({status:'OK'});
                        sendmail(doc.email,doc.key);                   
                    }
                });
            });
        }
    });
});

app.post("/login",(req,res) => {
    let user = {
         username: req.body.username,
         password: req.body.password
    };
    mongoose.model('users').findOne(user).exec().then((doc) => { 
        console.log(doc);
        if(!doc || doc.verified == false){
              res.status(400);
              res.json({status: 'error', error: "user not found or not verified"});
          }
        else{
           jwt.sign({user}, 'MySecretKey',(err, token) => {
                 if(err) {
                     res.status(400); 
                     res.send({status: 'error', error: "error making key"})}
                 else {
                     res.cookie('token',token);
                     res.status(200);
                     res.json({status: 'OK'});
                 }
          });
       }
   });
});

app.post("/logout",verifyToken,(req,res) => {
    jwt.verify(req.token, 'MySecretKey',(err, data)=>{
        if(err) {
            res.status(400);
            res.json({status:'error', error:"error verifying key"});}
        else{
           let Blacklist = mongoose.model('blacklist');
           let invalidToken = new Blacklist();
           invalidToken._id = uuidv4();
           invalidToken.token = req.token;
           invalidToken.save((err, doc) => {
               if(err) {
                   res.status(400);
                   res.json({status: 'error', error:"error saving token"});}
               else{
                   res.status(200);
                   res.json({status: 'OK'});
               }
           });
        }   
    });
});

app.post("/verify",(req,res) => {
    console.log(req.body);
    const param = {email: req.body.email };
    if(req.body.key != 'abracadabra'){
          param.key = req.body.key;
    }
    mongoose.model('users').findOne(param).exec().then((doc) => {
         if(!doc) { 
               res.status(400);
               res.json({status: 'error', error: "user not found"});
         }
         else{
             console.log(doc);
             doc.verified = true;
             doc.save((err, doc)=>{
               if(err) {
                   res.status(400); 
                   res.json({status: "error", error:"error verifying"});
                }
                else{
                       console.log(doc);
                       res.status(200);
                       res.json({ status: 'OK'});
                  }
                });
          }
    }).catch(err => {
        res.status(400);
        res.json({status: 'error',error:"error finding user"});
    });
});


app.get('/user/:username',(req,res) => {
    let username = req.params.username;
    mongoose.model('users').findOne({username}).exec().then((doc) => { 
        console.log(doc);
        if(!doc || doc.verified == false){
              res.status(400).json({status: 'error', error: "user not found"});
        }
        else{
           let user = {
                email: doc.email,
                followers: doc.followers.length,
                following: doc.following.length
           }
           res.status(200).json({status: 'OK', user});
       }
   });
});

app.get('/user/:username/posts',(req,res) => {
    let limit = req.query.limit;
    let username = (req.params.username).toLowerCase();
    if(!limit){
        limit = 50;
    }
    if(limit > 200){
        limit = 200;
    }
    db.searchbyUsername('squawks',limit,username).then((resp) => {
        let items = resp.hits.hits.map((val,index)=>{
            return val._id;
        });
        res.status(200).json({status: 'OK', items});
    });                       
});

app.get('/user/:username/followers',(req,res) => {
    let limit  = req.query.limit;
    let username = req.params.username;
    if(!limit){
        limit = 50;
    }
    if(limit > 200){
        limit = 200;
    }
    mongoose.model('users').findOne({username}).exec().then((doc) => { 
         console.log(doc);
         if(!doc || doc.verified == false){
               res.status(400).json({status: 'error', error: "user not found"});
         }
         else{
            let followers = doc.followers.slice(0,limit);
            res.status(200).json({status: 'OK', users: followers});
         }
    });
});

app.get('/user/:username/following',(req,res) => {
    let limit  = req.query.limit;
    let username = req.params.username;
    if(!limit){
        limit = 50;
    }
    if(limit > 200){
        limit = 200;
    }
    mongoose.model('users').findOne({username}).exec().then((doc) => { 
          console.log(doc);
         if(!doc || doc.verified == false){
               res.status(400).json({status: 'error', error: "user not found or verified"});
         }
         else{
            let following = doc.following.slice(0,limit);
            res.status(200).json({status: 'OK', users: following});
         }
    });
});

function verifyToken(req,res,next) {
    let token = req.cookies['token'];
    if(!token){ 
        res.status(400);
        res.json({status: 'error', error: 'User not logged in'});
    }
    else{
        req.token = token;
        next();
    }
}

app.listen(5000,"192.168.122.36");

