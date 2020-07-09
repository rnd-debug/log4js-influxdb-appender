const { test } = require('tap');
const sandbox = require('@log4js-node/sandboxed-module');
const appender = require('../../lib');

function setupLogging(category, options) {
  const fakeInflux = {
    config: null,
    databases: [],
    points: [],
    InfluxDB: class {
      constructor(config) {
        fakeInflux.config = config;
        fakeInflux.databases = [];
        fakeInflux.writtenPoints = [];
      }

      // eslint-disable-next-line class-methods-use-this
      getDatabaseNames() {
        return new Promise((resolve) => resolve(fakeInflux.databases));
      }

      // eslint-disable-next-line class-methods-use-this
      createDatabase(database) {
        return new Promise((resolve) => {
          fakeInflux.databases.push(database);
          resolve();
        });
      }

      // eslint-disable-next-line class-methods-use-this
      writePoints(points) {
        fakeInflux.writtenPoints = points;
        return new Promise((resolve) => resolve());
      }
    },
  };

  const fakeConsole = {
    log: () => {},
    error(msg) {
      this.msg = msg;
    },
  };

  const appenderModule = sandbox.require('../../lib', {
    globals: {
      console: fakeConsole,
    },
    requires: {
      influx: fakeInflux,
    },
  });

  const log4js = sandbox.require('log4js', {
    requires: {
      'log4js-influxdb-appender': appenderModule,
    },
    ignoreMissing: true,
  });

  // eslint-disable-next-line no-param-reassign
  options.type = 'log4js-influxdb-appender';
  log4js.configure({
    appenders: { influx: options },
    categories: { default: { appenders: ['influx'], level: 'trace' } },
  });

  return {
    logger: log4js.getLogger(category),
    shutdown: log4js.shutdown,
    fakeInflux,
    fakeConsole,
  };
}

function checkMessages(assert, result, measurement, tags, fields) {
  result.fakeInflux.writtenPoints.forEach((msg) => {
    assert.equal(msg.measurement, measurement);
    assert.hasFields(msg, { timestamp: /.*/ });
    Object.keys(tags).forEach((tag) => {
      assert.equal(msg.tags[tag], tags[tag]);
    });
    Object.keys(fields).forEach((tag) => {
      assert.equal(msg.fields[tag], fields[tag]);
    });
  });
}

test('influxdb-appender', (batch) => {
  batch.test('should export a configure function', (t) => {
    t.type(appender.configure, 'function');
    t.end();
  });

  batch.test('with default configuration - sending strings', (t) => {
    const setup = setupLogging(null, {});

    setTimeout(() => {
      t.test('client should be configured', (assert) => {
        assert.equal(setup.fakeInflux.config.host, 'localhost');
        assert.equal(setup.fakeInflux.config.database, 'log4js_db');
        assert.equal(setup.fakeInflux.databases.length, 1);
        assert.equal(setup.fakeInflux.databases[0], 'log4js_db');
        assert.end();
      });
    }, 200);

    setup.logger.trace('my message');

    setTimeout(() => {
      t.test('should send string message', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);
        checkMessages(t, setup, 'default', { level: 'TRACE' }, { data: 'my message' });
        assert.end();
        t.end();
      });
    }, 500);
  });

  batch.test('with default configuration - sending objects', (t) => {
    const setup = setupLogging(null, {});
    const msg = { message: 'pizza rules', comment: 'not important' };
    setup.logger.trace(msg);

    setTimeout(() => {
      t.test('should send stringified object', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);

        assert.contains(
          setup.fakeInflux.writtenPoints[0].fields.data,
          "{ message: 'pizza rules', comment: 'not important' }",
        );
        checkMessages(t, setup, 'default', { level: 'TRACE' }, {});
        assert.end();
        t.end();
      });
    }, 200);
  });

  batch.test('with context', (t) => {
    const setup = setupLogging(null, {});
    const context = 'foo';
    setup.logger.addContext('measurement', context);
    setup.logger.debug('my message with context');

    setTimeout(() => {
      t.test('should send string message', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);
        checkMessages(t, setup, context, { level: 'DEBUG' }, { data: 'my message with context' });
        assert.end();
        t.end();
      });
    }, 200);
  });

  batch.test('with category', (t) => {
    const measurement = 'speedMeasurement';

    const setup = setupLogging(measurement, {});
    setup.logger.debug('my message to another measurement');

    setTimeout(() => {
      t.test('should send string message to another measurement', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);
        checkMessages(
          t,
          setup,
          measurement,
          { level: 'DEBUG' },
          { data: 'my message to another measurement' },
        );
        assert.end();
        t.end();
      });
    }, 200);
  });

  batch.test('with maxBatchSize', (t) => {
    const setup = setupLogging(null, { maxBatchSize: 4 });
    const messages = [];
    for (let i = 0; i < 5; i += 1) {
      messages.push(`this is my buffered msg ${i}`);
    }

    setTimeout(() => {
      // giving time to create the db
      setup.logger.debug(messages[0]);
      setup.logger.debug(messages[1]);
      setup.logger.debug(messages[2]);
    }, 100);
    setTimeout(() => {
      t.test('should not send before maxBatchSize reached ', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 0);

        assert.end();
      });
      setup.logger.debug(messages[3]);
    }, 200);

    setTimeout(() => {
      t.test('should send when maxBatchSize reached ', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 4);

        checkMessages(t, setup, 'default', { level: 'DEBUG' }, {});
        assert.end();
        t.end();
      });
    }, 400);
  });

  batch.test('with custom configuration', (t) => {
    const customConfiguration = {
      database: 'custom_db',
      host: '8.8.8.8',
      port: 1234,
      measurement: 'intoxication',
      username: 'admin',
      password: '12345',
      fields: ['cheese', 'wine'],
      tags: ['scientist', 'location'],
    };
    const setup = setupLogging('fancyLogger', customConfiguration);

    setTimeout(() => {
      t.test('client should be configured', (assert) => {
        assert.equal(setup.fakeInflux.config.host, '8.8.8.8');
        assert.equal(setup.fakeInflux.config.port, 1234);
        assert.equal(setup.fakeInflux.config.database, 'custom_db');
        assert.equal(setup.fakeInflux.databases.length, 1);
        assert.equal(setup.fakeInflux.databases[0], 'custom_db');
        assert.equal(setup.fakeInflux.config.username, 'admin');
        assert.equal(setup.fakeInflux.config.password, '12345');
        assert.end();
      });
    }, 200);

    setup.logger.trace({
      cheese: 'brie',
      wine: 'chardonnay',
      scientist: 'Marie Curie',
      location: 'Paris',
    });

    setTimeout(() => {
      t.test('should send string message to custom db', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);

        checkMessages(
          t,
          setup,
          'intoxication',
          {
            scientist: 'Marie Curie',
            location: 'Paris',
          },
          {
            cheese: 'brie',
            wine: 'chardonnay',
          },
        );
        assert.end();
        t.end();
      });
    }, 2000);
  });

  batch.test('with layout', (t) => {
    const measurement = 'myDisplacement';
    const message = 'message sent with plain format';
    const setup = setupLogging(measurement, { layout: { type: 'basic' } });

    setup.logger.trace(message);

    setTimeout(() => {
      t.test('should send when maxBatchSize reached ', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);
        assert.contains(
          setup.fakeInflux.writtenPoints[0].fields.data,
          `[TRACE] ${measurement} - ${message}`,
        );
        checkMessages(t, setup, measurement, { level: 'TRACE' }, {});
        assert.end();
        t.end();
      });
    }, 200);
  });

  batch.test('with custom fields - sending objects', (t) => {
    const setup = setupLogging(null, { fields: ['cheese'], tags: ['scientist'] });
    const msg = { scientist: 'Marie Curie', cheese: 'camembert' };
    setup.logger.info(msg);

    setTimeout(() => {
      t.test('should send stringified object', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);

        checkMessages(t, setup, 'default', { scientist: 'Marie Curie' }, { cheese: 'camembert' });
        assert.end();
        t.end();
      });
    }, 200);
  });

  batch.test('with an existing db', (t) => {
    const setup = setupLogging(null, { database: 'existingDB' });
    setup.fakeInflux.databases.push('existingDB');

    setup.logger.debug('OK');

    setTimeout(() => {
      t.test('should send stringified object', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 1);
        assert.end();
        t.end();
      });
    }, 200);
  });

  batch.test('with a shutdown', (t) => {
    const setup = setupLogging(null, { maxBatchSize: 5 });

    setTimeout(() => {
      // giving time to create db
      setup.logger.debug('message one');

      t.test('should not send yet', (assert) => {
        assert.equal(setup.fakeInflux.writtenPoints.length, 0);
        setup.shutdown(() => {});
        setTimeout(() => {
          // giving time to shutdown
          assert.equal(setup.fakeInflux.writtenPoints.length, 1);
          assert.end();
          t.end();
        }, 400);
      });
    }, 200);
  });

  batch.end();
});
