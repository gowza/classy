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

GetSignature.prototype.map = function map(query) {
  var values = this.values,
    mappedQuery = {};

  this.keys.forEach(function (key, i) {
    if (query.hasOwnProperty(values[i])) {
      mappedQuery[key] = query[values[i]];
    }
  });

  return mappedQuery;
};

GetSignature.prototype.keys = [];

GetSignature.prototype.values = [];

GetSignature.prototype.priority = 0;

module.exports = GetSignature;