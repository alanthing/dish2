/**
 * Command which deletes organisation units with associated data.
 */

const csvtojson = require('csvtojson');
const urlsync = require('urllib-sync');
const conf = require('./configManager.js');

const app = {
  getOptions: {
    auth: conf.getAuth(),
    method: 'get',
    timeout: 60000
  },
  postOptions: {
    auth: conf.getAuth(),
    method: 'post',
    timeout: 60000
  },
  deleteOptions: {
    auth: conf.getAuth(),
    method: 'delete',
    timeout: 60000
  },
  orgUnitsUrl: conf.getConf().api.baseUrl + '/organisationUnits',
  pruneUrl: conf.getConf().api.baseUrl + '/maintenance/dataPruning/organisationUnits',
  filename: conf.getFile(),
  deleteCount: 0,
  errorCount: 0
}

/**
 * Removes org units provided as the given json structure.
 * @param json the organisation units to remove.
 */
app.removeOrgUnits = function(orgUnits) {
    var obj,
        prop,
        props = ['name','code'];

    for (var i=0; i<orgUnits.length; i++) {
        obj = orgUnits[i];

        for (var j=0; j<props.length; j++) {
            prop = props[j];
            if (obj.hasOwnProperty(prop) && app.removeOrgUnit(obj,prop)) {
                break;
            }
        }
    }

    console.log('Process completed!');
    console.log();
    console.log('Org units deleted: ' + app.deleteCount);
    console.log('Total no of org units: ' + orgUnits.length);
    console.log('Errors occured: ' + app.errorCount);
}

/**
 * Deletes the given org unit using the DHIS 2 Web API.
 * @param obj the org units.
 * @param prop the property name, can be "name", "uid", "code".
 * @returns {boolean} true if the org unit was deleted, false otherwise.
 */
app.removeOrgUnit = function(obj,prop) {
    var ouResp, ous, ou, delUrl, delResp;
    var url = app.orgUnitsUrl + '.json?paging=false&filter=' + prop + ':eq:' + obj[prop];

    ouResp = urlsync.request(url, app.getOptions);
    ous = JSON.parse(ouResp.data.toString('utf8'));

    if (ous && ous.organisationUnits && ous.organisationUnits[0]) {
        ou = ous.organisationUnits[0];
        delDataUrl = app.pruneUrl + '/' + ou.id;
        delOuUrl = app.orgUnitsUrl + '/' + ou.id;

        console.log('Delete data for org unit URL: ' + delDataUrl);
        console.log('Delete org unit URL: ' + delOuUrl);

        delDataResp = urlsync.request(delDataUrl, app.postOptions);

        if (delDataResp && 200 == delDataResp.status) {
          console.log('Data for org unit successfully deleted: ' + ou.id + ', ' + ou.name);
        }
        else {
          console.log('Data for org unit could not be deleted: ' + ou.id + ', ' + ou.name);
        }

        delOuResp = urlsync.request(delOuUrl, app.deleteOptions);

        if (delOuResp && 204 == delOuResp.status) {
            console.log('Org unit successfully deleted: ' + ou.id + ', ' + ou.name);
            app.deleteCount++;
            return true;
        }
        else {
            console.log('Org unit could not be deleted: ' + ou.id + ', ' + ou.name);
            app.errorCount++;
        }
    }
    else {
        console.log('Org unit not found: "' + obj.name + '" using prop: "' + prop + '"');
        app.notFoundCount++;
    }

    return false;
}

/**
 * Reads the CSV file and converts the content to JSON.
 * @param doneFn callback to apply with the JSON structure.
 */
app.convertCsvToJson = function(doneFn) {
    var Converter = require('csvtojson').Converter;
    var converter = new Converter({});
    converter.on('end_parsed', doneFn);
    fs.createReadStream(conf.getFile()).pipe(converter);
}

/**
* Runs command.
*/
app.run = function() {
  if (!conf.getFile() || !conf.getFile().length) {
    console.log("Usage: node remove_org_units.js --file <name-of-org-unit-csv-file>");
    return;
  }

  app.convertCsvToJson(app.removeOrgUnits);
}

app.run();