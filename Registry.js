/*jslint
  node: true,
  indent: 2
*/

"use strict";

function buildMatchFunc(query) {
  var keys = Object.keys(query);

  return function (entry) {
    return keys.every(function (key) {
      return entry[key] === query[key];
    });
  };
}

function Registry(keys) {
  Object.defineProperty(this, "keys", {
    "value": keys
  });
}

Registry.prototype.keys = [];

Registry.prototype.get = function (obj) {
  var self = this,
    key = this.buildKey(obj);

  if (key === false) {
    return Object.keys(this)
      .map(function (key) {
        return self[key];
      })
      .filter(buildMatchFunc(obj));
  }

  if (this.hasOwnProperty(key)) {
    return [this[key]];
  }

  return [];
};

Registry.prototype.buildKey = function buildKey(obj) {
  var i = 0,
    key = [];

  while (i < this.keys.length) {
    if (!obj.hasOwnProperty(this.keys[i])) {
      return false;
    }

    key.push(String(obj[this.keys[i]]));

    i += 1;
  }

  return key.join('-');
};

Registry.prototype.forIn = function forIn(callback) {
  var key;

  for (key in this) {
    if (
      this.hasOwnProperty(key) &&
        this.propertyIsEnumerable(key)
    ) {
      callback(this[key], key, this);
    }
  }
};

module.exports = Registry;