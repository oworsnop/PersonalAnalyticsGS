// Based on the code originally found in: https://github.com/loghound/Fitbit-for-Google-App-Script

// This script will pull down your "intraday" fitbit data
// and push it into a spreadsheet; this requires that you have been granted permission
// to intraday API. This has to be requested from FitBit and is granted on a case-by-case
// basis
//
//
/**** Length of time to look at.
 * From fitbit documentation values are 
 * 1d, 7d, 30d, 1w, 1m, 3m, 6m, 1y, max.
*/
var period = "1d";
/**
 * Key of ScriptProperty for Firtbit consumer key.
 * @type {String}
 * @const
 */
var CONSUMER_KEY_PROPERTY_NAME = "<YOUR CONSUMER KEY>";

/**
 * Key of ScriptProperty for Fitbit consumer secret.
 * @type {String}
 * @const
 */
var CONSUMER_SECRET_PROPERTY_NAME = "<YOUR CONSUMER SECRET>";


function refreshTimeSeries() {

    // if the user has never configured ask him to do it here
    if (!isConfigured()) {
        renderFitbitConfigurationDialog();
        return;
    }

    var user = authorize();
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var range = SpreadsheetApp.getActiveSpreadsheet().getLastRow();
  
    var options =
    {
        "oAuthServiceName": "fitbit",
        "oAuthUseToken": "always",
        "method": "GET",
    };
  
    var index = 0;
    range++;
    var cell = doc.getRange("a" + range);
  
    var activities = ["activities/log/steps"]
      
    for (var activity in activities) {
        var today = new Date();
        today.setDate(today.getDate() -1);            
        var dateString = Utilities.formatDate(today, "GMT", "yyyy-MM-dd");
        Logger.log(dateString);
      
        var currentActivity = activities[activity];
        try {
            var result = UrlFetchApp.fetch("http://api.fitbit.com/1/user/-/" + currentActivity + "/date/" + dateString
            + "/" + period + ".json", options);
            //
        } catch(exception) {
            Logger.log(exception);
        }
        var o = Utilities.jsonParse(result.getContentText());
         
        // Get the current date
        for (var i in o)
        {
          var section = o[i];
          if (i == "activities-log-steps")
          {
            var val = o[i];
            for (var j in val)
            {
              var sDateRow = val[j];
              var curDate = sDateRow["dateTime"];
            }
            break;
          }
        }
        
        // Get the intraday data
        for (var i in o)
        {
          var section = o[i];
          if (i == "activities-log-steps-intraday")
          {
            // ASSERT: dealing with intraday data
            var val = o[i];
            for (var s in val)
            {
              var sRow = val[s];
              for (var id in sRow)
              {
                var iRow = sRow[id];
                var curTime = iRow["time"];
                var curSteps = iRow["value"];
                if (curSteps > 0)
                {         
                  // ASSERT: don't need records with no steps; these can be inferred
                  cell.offset(index, 0 + activity * 1.0).setValue(curDate);
                  cell.offset(index, 1 + activity * 1.0).setValue(curTime);
                  cell.offset(index, 2 + activity * 1.0).setValue(curSteps);                  
                  index++;
                }
              }
            }
          }
        }
    }
    index = 0;
}

function isConfigured() {
    return getConsumerKey() != "" && getConsumerSecret() != "";
}

/**
 * @return String OAuth consumer key to use when tweeting.
 */
function getConsumerKey() {
    var key = ScriptProperties.getProperty(CONSUMER_KEY_PROPERTY_NAME);
    if (key == null) {
        key = "";
    }
    return key;
}

/**
 * @param String OAuth consumer key to use when tweeting.
 */
function setConsumerKey(key) {
    ScriptProperties.setProperty(CONSUMER_KEY_PROPERTY_NAME, key);
}

/**
 * @return String OAuth consumer secret to use when tweeting.
 */
function getConsumerSecret() {
    var secret = ScriptProperties.getProperty(CONSUMER_SECRET_PROPERTY_NAME);
    if (secret == null) {
        secret = "";
    }
    return secret;
}

/**
 * @param String OAuth consumer secret to use when tweeting.
 */
function setConsumerSecret(secret) {
    ScriptProperties.setProperty(CONSUMER_SECRET_PROPERTY_NAME, secret);
}

/** Retrieve config params from the UI and store them. */
function saveConfiguration(e) {

    setConsumerKey(e.parameter.consumerKey);
    setConsumerSecret(e.parameter.consumerSecret);
    var app = UiApp.getActiveApplication();
    app.close();
    return app;
}
/**
 * Configure all UI components and display a dialog to allow the user to 
 * configure approvers.
 */
function renderFitbitConfigurationDialog() {
    var doc = SpreadsheetApp.getActiveSpreadsheet();
    var app = UiApp.createApplication().setTitle(
    "Configure Fitbit");
    app.setStyleAttribute("padding", "10px");

    var helpLabel = app.createLabel(
    "From here you will configure access to fitbit -- Just supply your own"
    + "consumer key and secret \n\n"
    + "Important:  To authroize this app you need to load the script in the script editor"
    + " (tools->Script Manager) and then run the 'authorize' script.");
    helpLabel.setStyleAttribute("text-align", "justify");
    helpLabel.setWidth("95%");
    var consumerKeyLabel = app.createLabel(
    "Fitbit OAuth Consumer Key:");
    var consumerKey = app.createTextBox();
    consumerKey.setName("consumerKey");
    consumerKey.setWidth("100%");
    consumerKey.setText(getConsumerKey());
    var consumerSecretLabel = app.createLabel(
    "Fitbit OAuth Consumer Secret:");
    var consumerSecret = app.createTextBox();
    consumerSecret.setName("consumerSecret");
    consumerSecret.setWidth("100%");
    consumerSecret.setText(getConsumerSecret());



    var saveHandler = app.createServerClickHandler("saveConfiguration");
    var saveButton = app.createButton("Save Configuration", saveHandler);

    var listPanel = app.createGrid(4, 2);
    listPanel.setStyleAttribute("margin-top", "10px")
    listPanel.setWidth("90%");
    listPanel.setWidget(1, 0, consumerKeyLabel);
    listPanel.setWidget(1, 1, consumerKey);
    listPanel.setWidget(2, 0, consumerSecretLabel);
    listPanel.setWidget(2, 1, consumerSecret);

    // Ensure that all form fields get sent along to the handler
    saveHandler.addCallbackElement(listPanel);

    var dialogPanel = app.createFlowPanel();
    dialogPanel.add(helpLabel);
    dialogPanel.add(listPanel);
    dialogPanel.add(saveButton);
    app.add(dialogPanel);
    doc.show(app);
}

function authorize() {
    var oAuthConfig = UrlFetchApp.addOAuthService("fitbit");
    oAuthConfig.setAccessTokenUrl("http://api.fitbit.com/oauth/access_token");
    oAuthConfig.setRequestTokenUrl("http://api.fitbit.com/oauth/request_token");
    oAuthConfig.setAuthorizationUrl("http://api.fitbit.com/oauth/authorize");
    oAuthConfig.setConsumerKey(getConsumerKey());
    oAuthConfig.setConsumerSecret(getConsumerSecret());

    var options =
    {
        "oAuthServiceName": "fitbit",
        "oAuthUseToken": "always",
    };

    // get The profile but don't do anything with it -- just to force authentication
    var result = UrlFetchApp.fetch("http://api.fitbit.com/1/user/-/profile.json", options);
    //
    var o = Utilities.jsonParse(result.getContentText());

    return o.user;
    // options are dateOfBirth, nickname, state, city, fullName, etc.  see http://wiki.fitbit.com/display/API/API-Get-User-Info
}


/** When the spreadsheet is opened, add a Fitbit menu. */
function onOpen() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var menuEntries = [{
        name: "Refresh fitbit Time Data",
        functionName: "refreshTimeSeries"
    },
    {
        name: "Configure",
        functionName: "renderFitbitConfigurationDialog"
    }];
    ss.addMenu("Fitbit", menuEntries);
}

function onInstall() {
    onOpen();
    // put the menu when script is installed
}

