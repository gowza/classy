/*jslint
  node: true,
  indent: 2,
  evil: true
*/

"use strict";

var Class = require('./Class');

module.exports = function returnClass(module) {
  // Parse Classname from File name
  var className = /\/([A-Z][A-Za-z]+)\.js$/.exec(module.filename),
    Implementation;

  Implementation = function Implementation() {
    Implementation.constructor.apply(this, arguments);
    return this.init.apply(this, arguments);
  };

  if (className) {
    Implementation = eval('(' + Implementation.toString()
      .replace(/Implementation/g, className[1]) + ')');
  } else {
    className = '';
  }

  Implementation.prototype = new Class(Implementation);

  Implementation.is = Implementation.is.bind(Implementation);

  module.exports = Implementation;

  return Implementation;
};