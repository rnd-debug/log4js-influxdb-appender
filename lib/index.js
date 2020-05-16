const debug = require('debug')('log4js:influxdb');
const Influx = require('influx');
const _ = require('lodash');

function influxAppender(
  host,
  database,
  username,
  password,
  configMeasurement,
  configFields,
  configTags,
  maxBatchSize,
  layout,
) {
  debug(
    `constructor: creating InfluxAppender with host ${host},
     database ${database}
     measurement  ${configMeasurement}
     fields  ${configFields}
     tags  ${configTags}
     maxBatchSize  ${maxBatchSize}`,
  );
  let buffer = [];
  let isConnected = false;
  let canWrite = false;
  let shutdownAttempts = 5;
  let client;

  function formatLogLevel(logEvent) {
    return logEvent.level.toString();
  }

  function formatData(logEvent) {
    return layout(logEvent);
  }

  function getKeys(obj, keys) {
    return _.pick(obj, keys);
  }

  const getMeasurement = (property, event) =>
    event.context.measurement || event[property] || event.context[property]; // eslint-disable-line implicit-arrow-linebreak

  const shouldWriteBatch = () => buffer.length >= maxBatchSize;

  const parseLogEvent = (logEvent, fields) => {
    let res = getKeys(logEvent, fields);
    if (fields.includes('level')) {
      res.level = formatLogLevel(logEvent);
    }
    if (fields.includes('data')) {
      res.data = formatData(logEvent);
    } else {
      logEvent.data.forEach((elm) => {
        res = {
          ...res,
          ...getKeys(elm, fields),
        };
      });
    }

    return res;
  };

  function processLogEvent(loggingEvent) {
    const measurement = configMeasurement || getMeasurement('categoryName', loggingEvent);

    const fields = parseLogEvent(loggingEvent, configFields);
    const tags = parseLogEvent(loggingEvent, configTags);
    return {
      measurement,
      timestamp: loggingEvent.startTime,
      tags,
      fields,
    };
  }

  function write() {
    canWrite = false;
    client
      .writePoints(buffer.map((logEvent) => processLogEvent(logEvent)))
      .then(() => {
        buffer = [];
        canWrite = true;
      })
      .catch((err) => {
        console.error(err);
      });
  }

  function emptyBuffer() {
    debug(`emptying buffer of size ${buffer.length}`);
    write();
  }

  function createClient() {
    debug('creating client.');
    const influxConfig = {
      host,
      database,
      username,
      password,
    };
    client = new Influx.InfluxDB(influxConfig);
    client
      .getDatabaseNames()
      .then((names) => {
        if (!names.includes(database)) {
          debug('database not found: creating new database');
          return client.createDatabase(database);
        }
        debug('existing database found');
        return null;
      })
      .then(() => {
        emptyBuffer();
        canWrite = true;
        isConnected = true;
        return client;
      })
      .catch((err) => {
        throw new Error(err);
      });
  }

  createClient();

  function log(loggingEvent) {
    buffer.push(loggingEvent);
    if (canWrite && shouldWriteBatch()) {
      write();
    }
  }

  log.shutdown = (cb) => {
    debug('shutdown called');

    if (buffer.length && shutdownAttempts) {
      debug('buffer has items, trying to empty');
      if (isConnected) {
        canWrite = false;
        emptyBuffer();
      } else {
        debug('cannot connect, waiting 100ms to empty');
      }
      shutdownAttempts -= 1;
      setTimeout(() => {
        log.shutdown(cb);
      }, 100);
    } else {
      isConnected = false;
      cb();
    }
  };

  return log;
}

function configure(config, layouts) {
  let layout = layouts.messagePassThroughLayout;
  if (config.layout) {
    debug(`custom layout ${config.layout.type}`);
    layout = layouts.layout(config.layout.type, config.layout);
  }
  debug('configuring new appender');
  return influxAppender(
    config.host || 'localhost',
    config.database || 'log4js_db',
    config.username,
    config.password,
    config.measurement, // || 'categoryName',
    config.fields || ['data'],
    config.tags || ['level', 'pid'],
    config.maxBatchSize || 1,
    layout,
  );
}

module.exports.configure = configure;
