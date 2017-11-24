/**
 * Module dependencies.
 */

const debug = require('debug')('vnng-eventjs');
const Emitter = require('events');
const amqp = require('amqplib');
const compose = require('koa-compose');
const { FANOUT } = require('./exchangeType');

/**
 * Expose `Application` class.
 * Inherits from `Emitter.prototype`.
 */

module.exports = class Application extends Emitter {
  constructor() {
    super();

    this.middleware = [];
    this.defaultSettings();
  }

  /**
   * Default setting for application
   *
   * @api private
   */
  defaultSettings() {
    this.settings = {
      _host: '',
      _user: '',
      _password: '',
      _exchange: '',
      _type: FANOUT,
      _exchangeOption: { durable: true },
      _queue: '',
      _queueOption: { exclusive: true },
      _consumeOption: { noAck: true },
      _aggregate: '',
      _events: []
    };
  }

  /**
   * Assign seting name to value
   *
   * @param {String} name name
   * @param {Mixin} value value
   * @returns {Application} self
   * @api public
   */

  set(name, value) {
    this.settings = { ...this.settings, [name]: value };
    return this;
  }

  /**
   * Use the given middleware `fn`.
   *
   * @param {Function} fn
   * @return {Application} self
   * @api public
   */

  use(fn) {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    debug('use %s', fn._name || fn.name || '-');
    this.middleware.push(fn);
    return this;
  }

  /**
   * Build connect url from setting
   *
   * @return {String} url
   * @api private
   */

  url() {
    const { _user, _password, _host } = this.settings;
    const account = _user && _password ? `${_user}:${_password}@` : '';
    return `amqp://${account}${_host}`;
  }

  /**
   * Listenning on message and passing message to middleware
   */

  async listen() {
    return this.start(this.callback());
  }

  /**
   * Start subcriber
   *
   * @param {Async} cb callback
   * @api private
   */

  async start(cb) {
    debug('start');
    const url = this.url();
    debug('url=%s', url);
    debug('settings=%o', this.settings);
    const { _consumeOption, _queue, _queueOption, _aggregate, _events = [], _type, _exchangeOption } = this.settings;

    const con = await amqp.connect(url);
    debug('Connected to server');
    const channel = await con.createChannel();
    debug('Channel created');
    await channel.assertExchange(_aggregate, _type, _exchangeOption);
    debug('Channel asserted= %s', _aggregate);
    const { queue } = await channel.assertQueue(_queue, _queueOption);
    debug('Queue asserted= %s', _queue);
    debug('Wait for:');
    _events.forEach(evtKey => {
      debug('- aggregate= %s, key= %s', _aggregate, evtKey);
      channel.bindQueue(queue, _aggregate, evtKey);
    });

    channel.consume(
      queue,
      msg => {
        debug('received %o', JSON.stringify(msg));
        cb(msg);
      },
      _consumeOption
    );
  }

  /**
   * Return a message handler callback
   *
   * @return {Function}
   * @api public
   */

  callback() {
    const fnMiddleware = compose(this.middleware);

    if (!this.listeners('error').length) {
      this.on('error', err => {
        debug('%o', err);
      });
    }

    const handleMessage = msg => {
      const ctx = this.createContext(msg);
      debug('context= %O', ctx);
      return fnMiddleware(ctx);
    };

    return handleMessage;
  }

  /**
   * Create context from message
   *
   * @returns {Object} context
   * @api private
   */

  createContext(msg) {
    return {
      ...this.destruct(msg)
    };
  }

  /**
   * Desstruct message
   *
   * @param {Object} msg
   */
  destruct(msg) {
    return { ...msg };
  }
};
