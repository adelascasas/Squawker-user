const mailer = require('nodemailer');

const sendMail = (email,key) => {

    var transporter = mailer.createTransport({
            host: '127.0.0.1',
            port: 25,
            secure: false,
            tls: {
              rejectUnauthorized: false
            }
    });

    transporter.sendMail({
                  from: 'ubuntu@nodeapp.cloud.compas.cs.stonybrook.edu',
                  to: email,
                  subject: 'Key for email verification',
                  text: `validation key: <${key}>`
           }, (err) => { if(err) {console.log("mail send error", err)}});

}

module.exports = sendMail;