var express = require("express");
var bodyParser = require('body-parser');
var bodyParserXML = require('express-xml-bodyparser');
var request = require('request');
var builder = require('xmlbuilder');

var port = 3000;

var app = express();

// We need the bodyParser to read the XML message for the NCIP protocol
app.use(bodyParserXML());

function fetchLoanByItemId(itemId) {
    return fetch(`${this.okapiUrl}/circulation/loans?query=(itemId=${itemId} AND status="Open")`, { headers: this.httpHeaders })
      .then(loansResponse => loansResponse.json())
      .then((loansJson) => {
        if (loansJson.loans.length === 0) {
          throw new SubmissionError({ load: { barcode: 'Loan with this item id does not exist', _error: 'Scan failed' } });
        } else {
          // PUT the loan with a returnDate and status 'Closed'
          return loansJson.loans[0];
        }
      });
  }

function checkin(loan) {
    Object.assign(loan, {
      returnDate: dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss'Z'"),
      status: { name: 'Closed' },
      action: 'checkedin',
    });

    return fetch(`${this.okapiUrl}/circulation/loans/${loan.id}`, {
      method: 'PUT',
      headers: this.httpHeaders,
      body: JSON.stringify(loan),
    })
    .then(() => loan);
  }

function checkout(loan) {
    Object.assign(loan, {
      returnDate: dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss'Z'"),
      status: { name: 'Closed' },
      action: 'checkedin',
    });

    return fetch(`${this.okapiUrl}/circulation/loans/${loan.id}`, {
      method: 'PUT',
      headers: this.httpHeaders,
      body: JSON.stringify(loan),
    })
    .then(() => loan);
  }

function renew(userid, itemid) {
  //Object.assign(loan, {
  //  returnDate: dateFormat(new Date(), "yyyy-mm-dd'T'HH:MM:ss'Z'"),
  //  status: { name: 'Closed' },
  //  action: 'checkedin',
  //});

  // Build Response Message  
  var xml = builder.create('NCIPMessage')
  .att('version', 'http://ncip.envisionware.com/documentation/ncip_v1_01.dtd')
  .ele('RenewItemResponse')
  .ele('ResponseHeader')
  .ele('FromAgencyId')
  .ele('UniqueAgencyId')
  .ele('Value', 'ABC')
  .end({ pretty: true});

  return xml;
}

function fetchLoan(loanid) {
    return fetch(`${this.okapiUrl}/circulation/loans?query=(id=${loanid})`, {
      headers: this.httpHeaders,
    }).then(response =>
      response.json().then((json) => {
        const loans = JSON.parse(JSON.stringify(json.loans));
        return this.fetchPatron(loans)
          .then((patron) => {
            const extLoans = loans[0];
            extLoans.patron = patron;
            return extLoans;
          }).then((extLoans) => {
            const scannedItems = [];
            scannedItems.push(extLoans);
            return this.props.mutator.scannedItems.replace(scannedItems.concat(this.props.resources.scannedItems));
          });
      }),
    );
  }

function getPatron(userId) {
  var url = 'http://localhost:9130/users/'+userId;
  var options = { 
  url: url,
  headers: { 
             'X-Okapi-Tenant': 'library1',
             'X-Okapi-Token': '1234567890',
             'Accept': 'application/json'
           }
  };
  var req = request(options, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      var user = JSON.parse(body);
      console.log('User Object: ');
      console.log(user);
      
      // Build Response Message  
      var xml = builder.create('NCIPMessage')
      .att('version', 'http://ncip.envisionware.com/documentation/ncip_v1_01.dtd')
      .ele('LookupUserResponse')
      .ele('ResponseHeader')
      .ele('FromAgencyId')
      .ele('UniqueAgencyId')
      .ele('Value', 'ABC').up().up().up()
      .ele('UniqueUserId')
      .ele('UniqueIdentifierValue', user.id).up()
      .ele('UserTransaction')
      .ele('RequestedItem')
      .ele('UniqueRequestId')
      .ele('RequestIdentifierValue', '987654').up()
      .ele('RequestType')
      .ele('Value', 'Hold').up().up()
      .ele('RequestStatusType')
      .ele('Value', 'In Process').up().up()
      .ele('Date Placed', '2017-09-28T14:35+01:00').up().up()
      .ele('LoanedItem')
      .ele('UniqueItemId')
      .ele('ItemIdentifierValue', '123456').up().up()
      .ele('DueDate', '2017-12-31T14:35+01:00').up().up().up()
      .ele('UserOptionalFields')
      .ele('NameInformation')
      .ele('PersonalNameInformation')
      .ele('StructuredPersonalUserName')
      .ele('GivenName', user.personal.firstName).up()
      .ele('SurName', user.personal.lastName)
      .end({ pretty: true});

      return xml;  
    } else {
      if (error != null) {
        console.log(error);
      } else {
        console.log('[' + response.statusCode + '] ' + url + ': ' + body);
      }
    }  
  });
}  

// Define the Router
var router = express.Router();

// Map the express router to the root of our app
//router.use(function(req, res, next) {
//  console.log("/" + req.method);
//  next();
//});

// Process all NCIP requests
router.get('/', function(req, res) {
  console.log("Processing Request");
  res.setHeader('Content-Type', 'text/xml');

  // Get Request Message
  var ncipMessage = req.body;
  console.log(ncipMessage);

  var userid = '1534f418-f0e9-45ba-9361-dc3ed5a2fffd';
  var xml = getPatron(userid);
  res.send(xml);
});

app.use('/ncip', router);

app.listen(port, function() {
  console.log("Listening on port " + port);
});