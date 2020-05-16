# log4js-influxdb-appender
[![NPM](https://nodei.co/npm/log4js-influxdb-appender.png?downloads=true)](https://nodei.co/npm/log4js-influxdb-appender/)

A simple appender for [log4js](https://www.npmjs.com/package/log4js) that writes to a [InfluxDB](https://www.influxdata.com/) database. Built on top of the [node-influxdb client](https://www.npmjs.com/package/influx).

## Installation

```
npm install log4js
npm install log4js-influxdb-appender
```

## Usage

### Default configuration

```javascript
const log4js = require('log4js');
log4js.configure({
  appenders: {
    influx: {
      type: "log4js-influxdb-appender",
    },
  },
  categories: {
    default: { appenders: ["influx"], level: "trace" },
  },
});
const logger = log4js.getLogger();
logger.debug("important string message"});
logger.trace({ param1: 'can serialize', param2: 'objects too' });
```

This will result in a message recorded in the database `log4js_db`, measurement `default`, of an InfluxDB (running on `localhost:8086`), as following :

```
name: default
time                      data                                                  level   pid
----                      -----                                                 ------  ------
2020-05-01T10:13:00.999Z  important string message                              DEBUG   6123
2020-05-01T10:13:01.999Z  { param1: 'can serialize', param2: 'objects too' }    TRACE   6123
```


## Configuration

- `type` - `log4js-influxdb-appender`
- `host` - `string` - (optional, default to `localhost`) hostname or IP-address of the target server
- `database` - `string` - (optional, default to `log4js_db`) name of the target database
- `username` - `string``- (optional) user name
- `password` - `string``- (optional) user password
- `measurement` - `string` - (optional) name of the target measurement. If not present, will use the category name of the appender.
- `fields` - `array` - (optional, default to `['data']`). Fields of the logging event to be used as fields in your InfluxDB.
- `tags` - `array` - (optional, default to `['level', 'pid']`). Fields of the logging event to be used as tags in your InfluxDB.
- `maxBatchSize` - `number` - (optional, defaults to 1) number of logs to buffer before sending them to InfluxDB. Note that node-influxdb recommends several hundreds.
- `layout` - (optional, defaults to layouts.messagePassThroughLayout) - the layout to use for logged messages.


## Examples

```javascript
const log4js = require('log4js');
log4js.configure({
  appenders: {
    influx: {
      type: 'log4js-influxdb-appender',
      database: 'myDatabase',
      measurement: 'listOfScientists',
      maxBatchSize: 1000,
      fields: ['cheese', 'quantity'],
      tags: ['scientist'],
    },
  },
  categories: {
    default: { appenders: ['influx'], level: 'trace' },
  },
});
const logger = log4js.getLogger();
logger.info({ scientist: 'Marie Curie', cheese: 'roquefort', quantity: '100' });
```

This will result in a message recorded in the database `myDatabase`, measurement `listOfScientists`, of an InfluxDB (running on `localhost:8086`), as following :

```
name: listOfScientists
time                     cheese    quantity scientist
----                     ------    -------- ---------
2020-05-16T10:10:14.611Z roquefort 100      Marie Curie
```

## Acknowlegments

- [node-influxdb](https://www.npmjs.com/package/influx)
- [log4js](https://www.npmjs.com/package/log4js)

## License

Released under the MIT License.

Note that [node-influxdb](https://github.com/node-influx/node-influx) dependency has its own licensing.
