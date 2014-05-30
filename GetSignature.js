/*jslint
  node: true,
  indent: 2
*/

"use strict";

function GetSignature(exec) {
  this.exec = exec;
}

GetSignature.prototype.test = function test() {
  return true;
};

GetSignature.prototype.exec = function exec(query, callback) {
  setTimeout(callback.bind(null, []), 4);
};

GetSignature.prototype.map = function map(query, useAllQueryKeys) {
  var values = this.values,
    mappedQuery = {},
    keys = this.keys;

  if (useAllQueryKeys) {
    console.log(query);
    Object.keys(query)
      .forEach(function (key) {
        var i = values.indexOf(key);

        if (i === -1) {
          mappedQuery[key] = query[key];
        } else {
          mappedQuery[keys[i]] = query[key];
        }
      });
  } else {
    keys.forEach(function (key, i) {
      if (query.hasOwnProperty(values[i])) {
        mappedQuery[key] = query[values[i]];
      }
    });
  }

  return mappedQuery;
};

GetSignature.prototype.keys = [];

GetSignature.prototype.values = [];

GetSignature.prototype.priority = 0;

module.exports = GetSignature;