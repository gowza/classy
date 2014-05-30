/*jslint
  node: true,
  indent: 2
*/

"use strict";

var db = require('db'),
  is = require('is'),
  GetSignature = require('./GetSignature');

function toObj(keys, obj, optBase) {
  return keys.reduce(function (newObject, nextKey) {
    if (obj[nextKey] !== undefined) {
      newObject[nextKey] = obj[nextKey];
    }

    return newObject;
  }, optBase ? toObj(keys, optBase) : {});
}

function returnTrue() {
  return true;
}

function toName(col) {
  return col.Field;
}

function isPrimKey(col) {
  return col.Key === 'PRI';
}

function isAutoIncrement(col) {
  return col.Extra.indexOf('auto_increment') !== -1;
}

function getRowsFromDb(name, query, callback) {
  db("SELECT * FROM ?? WHERE ?", [name, query], callback);
}

function overWrite(self, name, func) {
  var invocations = [];

  func.super = self[name];

  self[name] = function () {
    invocations.push(arguments);
  };

  return function () {
    self[name] = func;

    invocations.forEach(function (args) {
      self[name].apply(self, args);
    });
  };
}

// Done
function updateOverwrite(details, callback) {
  var Implementation = this.constructor,
    primaryKeys = Implementation.registry.keys,
    name = Implementation.name,
    self = this;

  db('UPDATE ?? SET ? WHERE ?', [
    name,
    toObj(Implementation.properties, details),
    toObj(primaryKeys, self)
  ], function () {
    db("SELECT * FROM ?? WHERE ?", [name, toObj(primaryKeys, details, self)], function (rows) {
      if (rows.length !== 1) {
        throw new Error("Lost the instance");
      }

      updateOverwrite.super.call(self, rows[0], callback);
    });
  });
}

// Done
function deleteOverwrite(callback) {
  var Implementation = this.constructor;

  db('DELETE FROM ?? WHERE ?', [
    Implementation.name,
    toObj(Implementation.registry.keys, this)
  ], deleteOverwrite.super.bind(this, callback));
}

// Done
function createOverwrite(details, callback) {
  var Implementation = this,
    autoIncrement = this.autoIncrement;

  db("INSERT INTO ?? SET ? ON DUPLICATE KEY UPDATE ?", [this.name, details, details], function (result) {
    if (autoIncrement && result.insertId) {
      details[autoIncrement] = result.insertId;
    }

    getRowsFromDb(Implementation.name, details, function (rows) {
      createOverwrite.super.call(Implementation, rows[0], callback);
    });
  });
}

// Done
function addGetSignatureOverwrite(a1, a2, a3) {
  var getSignature,
    Implementation = this;

  function canBeMapped(query, callback) {
    getRowsFromDb(Implementation.name, this.map(query), callback);
  }

  switch (arguments.length) {
  case 1:
    if (a1 instanceof GetSignature) {
      return addGetSignatureOverwrite.super.call(this, a1);
    }

    getSignature = new GetSignature(a1);
    break;

  case 2:
  case 3:
    if (is.func(a2)) {
      getSignature = new GetSignature(a2);
    } else {
      getSignature = new GetSignature(canBeMapped);

      if (a2 === "usePrimaryKey") {
        getSignature.keys = getSignature.values = this.registry.keys;
      } else {
        getSignature.keys = Object.keys(a2);

        getSignature.values = getSignature.keys.map(function (key) {
          return a2[key];
        });
      }
    }

    getSignature.test = a1;

    if (a3) {
      getSignature.priority = a3;
    }
    break;
  }

  return addGetSignatureOverwrite.super.call(this, getSignature);
}

// The onlytime get needs to be overwritten is when
// there is an array of queries and all of them can be mapped
function getOverwrite(queries, callback) {
  var getSignatures = this.getSignatures,
    mappedQueries;

  function isTruthy(item) {
    return !!item;
  }

  if (!is.array(queries, 1, Infinity)) {
    return getOverwrite.super.call(this, queries, callback);
  }

  mappedQueries = queries.map(function (query) {
    var chosenSignature,
      i = getSignatures.length;

    do {
      i -= 1;
      chosenSignature = getSignatures[i];

      if (
        chosenSignature.test(query) &&
          chosenSignature.exec.name === 'canBeMapped'
      ) {
        return chosenSignature.map(query);
      }
    } while (i !== 0);

    return false;
  });

  if (!mappedQueries.every(isTruthy)) {
    return getOverwrite.super.call(this, queries, callback);
  }

  return getOverwrite.super.call(this, mappedQueries.reduce(function (query, next) {
    Object.keys(next)
      .forEach(function (key) {
        if (
          query.hasOwnProperty(key) &&
            query[key] !== next[key]
        ) {
          throw new Error("Key Clash" + key + next[key] + query[key]);
        }

        query[key] = next[key];
      });

    return query;
  }), callback);
}

module.exports = function mapToDBTable() {
  var Implementation = this,
    name = this.name;

  Implementation
    .on('dbReady', overWrite(Implementation.prototype, 'update', updateOverwrite))
    .on('dbReady', overWrite(Implementation.prototype, 'delete', deleteOverwrite))
    .on('dbReady', overWrite(Implementation, 'create', createOverwrite))
    .on('dbReady', overWrite(Implementation, 'addGetSignature', addGetSignatureOverwrite))
    .on('dbReady', overWrite(Implementation, 'get', getOverwrite));

  Implementation.getRowsFromDb = getRowsFromDb.bind(Implementation, name);

  db('DESCRIBE ??', [name], function (rows) {
    var getSignature = new GetSignature(function canBeMapped(query, callback) {
      getRowsFromDb(name, this.map(query, true), callback);
    });

    getSignature.test = function (query) {
      return Object.getPrototypeOf(query) === Object.prototype;
    };

    getSignature.keys = getSignature.values = Implementation.properties = rows.map(toName);

    getSignature.priority = -1;

    Implementation.addGetSignature(getSignature);

    Implementation.autoIncrement = rows.filter(isAutoIncrement)
      .map(toName)
      .pop();

    Implementation
      .addRegistry(rows.filter(isPrimKey).map(toName), true)
      .emit('dbReady');
  });
};