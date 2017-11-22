const App = require('./lib/application');
const ExchangeType = require('./lib/exchangeType');

exports = module.exports = createApplication;

/**
 * Create an express application.
 *
 * @return {Function}
 * @api public
 */
function createApplication() {
  return new App();
}

/**
 * Expose constants
 */
exports.ExchangeType = ExchangeType;
