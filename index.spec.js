const debug = require('debug')('vnng-eventjs');
const assert = require('assert');
const amqp = require('amqplib');
const eventjs = require('./');

// Test data
const AGGREGATE = 'DEV';
const AGGREGATE_ID = 'DEV:TODO1';
const message = {
  msg: 'It\'s work :D'
};
const EXCHANGE_CONFIG = { durable: false };
const amqpConfig = {
  host: '192.168.1.87',
  user: 'vnng',
  password: 'Vnng!t2016'
};
const amqpSettings = () => `amqp://${amqpConfig.user}:${amqpConfig.password}@${amqpConfig.host}?heartbeat=10`;

describe('EventJS Application', () => {
  it(`Start app without error -> receive successfully message from AGGREGATE= ${AGGREGATE}, AGGREGATE_ID= ${AGGREGATE_ID} `, (done) => {
    /**
     * Parse JSON middleware
     *
     * @param {String} msg
     */

    function parseMiddleware(ctx, next) {
      try {
        ctx.content = JSON.parse(ctx.originMsg.content.toString());
        next();
      } catch (e) {
        debug('Parse message error');
        throw e;
      }
    }


    const app = eventjs();

    app.set('_host', amqpConfig.host);
    app.set('_user', amqpConfig.user);
    app.set('_password', amqpConfig.password);
    app.set('_aggregate', AGGREGATE);
    app.set('_type', eventjs.ExchangeType.Fanout);
    app.set('_events', [AGGREGATE_ID]);
    app.use(parseMiddleware);
    app.use(function receiveMessage(ctx, next) {
      ctx.message = ctx.content;
      next();
    });

    app.use(function confirmMessage(ctx) {
      assert.deepEqual(ctx.message, message);
      done();
    });

    // app.use(eventjs.Router().on(AGGREGATE_ID, (ctx) => {
    //   console.log('ctx= ', Object.getPrototypeOf(ctx));
    //   assert.deepEqual(ctx.event.payload, message);
    //   done();
    // }));

    app.listen().then(() => {
      amqp.connect(amqpSettings()).then((con) => con.createChannel())
        .then(channel => {
          channel.assertExchange(AGGREGATE, eventjs.ExchangeType.Fanout, EXCHANGE_CONFIG);
          channel.publish(AGGREGATE, AGGREGATE_ID, Buffer.from(JSON.stringify(message)));
          console.log('Sent AGGREGATE= %s, AGGREGATE_ID= %s', AGGREGATE, AGGREGATE_ID);
        });
    });
  });
});
