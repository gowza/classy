/*jslint
  node: true,
  indent: 2
*/

"use strict";

var EventEmitter = require('event-emitter'),
  GetSignature = require('./GetSignature'),
  mapToDBTable = require('./dbAdaptor'),
  Registry = require('./Registry'),
  is = require('is'),
  db = require('db');

function noop() {}

function returnValue(value) {
  return value;
}

function intersection(arraysToIntersect) {
  var smallestLength = Infinity,
    smallestArray,
    i = 0;

  if (arraysToIntersect.length === 1) {
    return arraysToIntersect[0];
  }

  while (i < arraysToIntersect.length) {
    if (arraysToIntersect[i].length < smallestLength) {
      smallestArray = i;
    }

    i += 1;
  }

  smallestArray = arraysToIntersect.splice(smallestArray, 1)[0];

  return smallestArray.filter(function (item) {
    return arraysToIntersect.every(function (array) {
      return array.indexOf(item) !== -1;
    });
  });
}

function Class(Implementation) {
  this.constructor = Implementation;

  Implementation.getSignatures = [];

  Class.prototype.copyProperties.call(Implementation, Class);

  EventEmitter.make(Implementation);

  Implementation.constructor = noop;
}

Class.is = function is(instance) {
  return instance instanceof this;
};

/* Function: create
 * A static method used to create an object that did not previously exist
 */
Class.create = function create(details, callback) {
  var instance = new this(details);

  setTimeout(callback.bind(this, instance), 4);

  return this.emit("create", instance, callback);
};

/* Function: get
 * A static method used to get an object that does exist
 */
Class.get = function get(query, callback) {
  var getSignatures = this.getSignatures,
    Implementation = this,
    results = [],
    invocations = 0;

  function manipulateArrayThenCallback(result) {
    results.push(result.map(function (item) {
      return Implementation.is(item) ? item : new Implementation(item);
    }));

    invocations += 1;

    if (invocations === query.length) {
      results = intersection(results);
      callback(results[0] || null, results, results.length);
    }
  }

  query = [].concat(query)
    .map(function exec(details) {
      var i = getSignatures.length,
        getSignature;

      // If a getSignature returns false that means it does not match the function signatures and thus
      // another getSignature should be invoked
      do {
        i -= 1;
        getSignature = getSignatures[i];

        if (getSignature.test(details)) {
          getSignature.exec(details, manipulateArrayThenCallback);
          return true;
        }
      } while (i !== 0);

      throw new Error("Uncauht Query");
    });

  return this;
};

Class.addGetSignature = function addGetSignature(a1, a2, a3) {
  var getSignature;

  if (a1 instanceof GetSignature) {
    getSignature = a1;
  } else {
    switch (arguments.length) {
    case 1:
      getSignature = new GetSignature(a1);
      break;

    case 2:
      getSignature = new GetSignature(a2);
      getSignature.test = a1;
      break;

    case 3:
      getSignature = new GetSignature(a2);
      getSignature.test = a1;
      getSignature.priority = a3;
      break;
    }
  }

  this.getSignatures.push(getSignature);

  this.getSignatures.sort(function (a, b) {
    return a.priority > b.priority ? 1 : -1;
  });

  return this;
};

Class.addRegistry = function addRegistry(keys, noGetSignature) {
  var registry = new Registry(keys);

  this.registry = registry;

  if (noGetSignature) {
    return this;
  }

  return this.addGetSignature(function () {
    return true;
  }, function (query, callback) {
    callback(registry.get(query));
  });
};

Class.mapToDBTable = mapToDBTable;

Class.prototype = new EventEmitter();

Class.prototype.init = function (details) {
  var Implementation = this.constructor,
    registry = Implementation.registry,
    key;

  // If there is an registry
  // make sure that there is no clashing object on the registry
  // If there is, return the updated clash,
  // If there isnt add it into the registry

  this.copyProperties(details);

  if (registry) {
    key = registry.buildKey(this);

    if (!key) {
      throw new Error("Object does not contain all keys necessary to comply with registry.");
    }

    if (registry[key]) {
      return registry[key].copyProperties(this);
    }

    registry[registry.buildKey(this)] = this;
  }

  EventEmitter.call(this);
  Implementation.emit("new", this);
  return this;
};

Class.prototype.emit = function (eventName) {
  var Implementation = this.constructor,
    emit = EventEmitter.prototype.emit;

  emit.apply(Implementation, [eventName, this].concat([].slice.call(arguments, 1)));

  return emit.apply(this, arguments);
};

Class.prototype.delete = function delet(callback) {
  var registry = this.constructor.registry;

  if (registry) {
    delete registry[registry.buildKey(this)];
  }

  this.call(callback);

  return this.emit('delete');
};

Class.prototype.update = function update(values, callback) {
  var registry = this.constructor.registry;

  // If the key values change then you can end up with two of the same object
  // with different addresses in the registry, thanks to buildKey method this is quite
  // easy to fix
  if (registry) {
    delete registry[registry.buildKey(this)];
  }

  this.copyProperties(values);

  if (registry) {
    registry[registry.buildKey(this)] = this;
  }

  this.call(callback);

  return this.emit('update');
};

Class.prototype.copyProperties = function copyProperties(properties) {
  var key;

  for (key in properties) {
    if (properties.hasOwnProperty(key)) {
      this[key] = properties[key];
    }
  }

  return this;
};

Class.prototype.call = function call(callback) {
  if (typeof callback === 'function') {
    callback.apply(this, [].slice.call(arguments, 1));
  }

  return this;
};

module.exports = Class;